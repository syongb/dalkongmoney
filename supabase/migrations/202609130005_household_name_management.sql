do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'households'
      and policyname = 'owners can update their household'
  ) then
    raise exception 'Expected household update policy was not found.';
  end if;
end;
$$;

drop policy "owners can update their household" on public.households;

create policy "members can update their household name"
on public.households for update to authenticated
using (private.is_household_member(id))
with check (private.is_household_member(id));

create function private.broadcast_household_name_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is not distinct from old.name then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object('household_id', new.id, 'event_type', 'update'),
    'household_changed',
    'household:' || new.id::text || ':transactions',
    true
  );
  perform realtime.send(
    jsonb_build_object('household_id', new.id, 'event_type', 'update'),
    'household_changed',
    'household:' || new.id::text || ':budgets',
    true
  );
  return null;
end;
$$;

revoke all on function private.broadcast_household_name_change() from public;

create trigger broadcast_household_name_change
after update of name on public.households
for each row execute function private.broadcast_household_name_change();
