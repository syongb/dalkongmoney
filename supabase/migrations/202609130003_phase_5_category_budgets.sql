create function private.validate_budget_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_budget bigint;
  other_allocations bigint;
begin
  if tg_op = 'DELETE' then
    if old.category_id is null and exists (
      select 1
      from public.budgets
      where household_id = old.household_id
        and budget_month = old.budget_month
        and category_id is not null
    ) then
      raise exception '카테고리 예산이 있으면 전체 예산을 삭제할 수 없습니다.';
    end if;
    return old;
  end if;

  if new.category_id is null then
    select coalesce(sum(amount), 0)
      into other_allocations
    from public.budgets
    where household_id = new.household_id
      and budget_month = new.budget_month
      and category_id is not null;

    if other_allocations > new.amount then
      raise exception '카테고리별 예산 합계는 전체 생활비보다 클 수 없습니다.';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.categories
    where id = new.category_id
      and household_id = new.household_id
      and type = 'expense'
  ) then
    raise exception '지출 카테고리에만 예산을 설정할 수 있습니다.';
  end if;

  select amount
    into total_budget
  from public.budgets
  where household_id = new.household_id
    and budget_month = new.budget_month
    and category_id is null;

  if total_budget is null then
    raise exception '전체 생활비를 먼저 설정해주세요.';
  end if;

  select coalesce(sum(amount), 0)
    into other_allocations
  from public.budgets
  where household_id = new.household_id
    and budget_month = new.budget_month
    and category_id is not null
    and id <> new.id;

  if other_allocations + new.amount > total_budget then
    raise exception '카테고리별 예산 합계는 전체 생활비보다 클 수 없습니다.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_budget_assignment() from public;

create trigger validate_budget_assignment
after insert or update or delete on public.budgets
for each row execute function private.validate_budget_assignment();

create or replace function private.broadcast_budget_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := coalesce(new.household_id, old.household_id);
  target_budget_id uuid := coalesce(new.id, old.id);
begin
  perform realtime.send(
    jsonb_build_object(
      'budget_id', target_budget_id,
      'event_type', lower(tg_op)
    ),
    'budget_changed',
    'household:' || target_household_id::text || ':budgets',
    true
  );

  return null;
end;
$$;

revoke all on function private.broadcast_budget_change() from public;
