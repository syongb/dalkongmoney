do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Review existing category write policies before enabling category management.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'household members can receive transaction changes'
  ) or not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'household members can receive budget changes'
  ) then
    raise exception 'Expected household Realtime policies were not found.';
  end if;
end;
$$;

create policy "members can create expense categories"
on public.categories for insert to authenticated
with check (
  type = 'expense'
  and private.is_household_member(household_id)
);

create policy "members can update expense categories"
on public.categories for update to authenticated
using (
  type = 'expense'
  and private.is_household_member(household_id)
)
with check (
  type = 'expense'
  and private.is_household_member(household_id)
);

grant insert (household_id, name, sort_order, is_active, type)
  on public.categories to authenticated;
grant update (name, sort_order, is_active)
  on public.categories to authenticated;

create or replace function private.validate_budget_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.category_id is null and exists (
      select 1
      from public.budgets
      where household_id = old.household_id
        and budget_month = old.budget_month
        and category_id is not null
    ) then
      raise exception '카테고리 예산이 있으면 내부 전체 예산을 삭제할 수 없습니다.';
    end if;
    return old;
  end if;

  if new.category_id is not null and not exists (
    select 1
    from public.categories
    where id = new.category_id
      and household_id = new.household_id
      and type = 'expense'
  ) then
    raise exception '지출 카테고리에만 예산을 설정할 수 있습니다.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_budget_assignment() from public;

create function private.sync_overall_budget_from_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := coalesce(new.household_id, old.household_id);
  target_budget_month date := coalesce(new.budget_month, old.budget_month);
  target_category_id uuid := coalesce(new.category_id, old.category_id);
  category_budget_total bigint;
begin
  if target_category_id is null or pg_trigger_depth() > 1 then
    return null;
  end if;

  select coalesce(sum(amount), 0)
    into category_budget_total
  from public.budgets
  where household_id = target_household_id
    and budget_month = target_budget_month
    and category_id is not null;

  update public.budgets
  set amount = category_budget_total
  where household_id = target_household_id
    and budget_month = target_budget_month
    and category_id is null;

  if not found then
    begin
      insert into public.budgets (household_id, budget_month, amount, category_id)
      values (target_household_id, target_budget_month, category_budget_total, null);
    exception when unique_violation then
      update public.budgets
      set amount = category_budget_total
      where household_id = target_household_id
        and budget_month = target_budget_month
        and category_id is null;
    end;
  end if;

  return null;
end;
$$;

revoke all on function private.sync_overall_budget_from_categories() from public;

create trigger sync_overall_budget_from_categories
after insert or update or delete on public.budgets
for each row execute function private.sync_overall_budget_from_categories();

create function private.broadcast_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := coalesce(new.household_id, old.household_id);
  target_category_id uuid := coalesce(new.id, old.id);
begin
  perform realtime.send(
    jsonb_build_object(
      'category_id', target_category_id,
      'event_type', lower(tg_op)
    ),
    'category_changed',
    'household:' || target_household_id::text || ':transactions',
    true
  );

  perform realtime.send(
    jsonb_build_object(
      'category_id', target_category_id,
      'event_type', lower(tg_op)
    ),
    'category_changed',
    'household:' || target_household_id::text || ':budgets',
    true
  );

  return null;
end;
$$;

revoke all on function private.broadcast_category_change() from public;

create trigger broadcast_category_change
after insert or update on public.categories
for each row execute function private.broadcast_category_change();
