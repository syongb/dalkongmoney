do $$
begin
  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
  ) <> 1 or not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'household members can receive transaction changes'
  ) then
    raise exception 'Review realtime.messages policies before enabling household budget broadcasts.';
  end if;
end;
$$;

create policy "household members can receive budget changes"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.household_members
    where public.household_members.user_id = (select auth.uid())
      and realtime.topic() =
        'household:' || public.household_members.household_id::text || ':budgets'
  )
);

create function private.broadcast_budget_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := coalesce(new.household_id, old.household_id);
  target_budget_id uuid := coalesce(new.id, old.id);
begin
  if tg_op = 'INSERT' and new.category_id is not null then
    return null;
  elsif tg_op = 'DELETE' and old.category_id is not null then
    return null;
  elsif tg_op = 'UPDATE'
    and old.category_id is not null
    and new.category_id is not null then
    return null;
  end if;

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

create trigger broadcast_budget_change
after insert or update or delete on public.budgets
for each row execute function private.broadcast_budget_change();
