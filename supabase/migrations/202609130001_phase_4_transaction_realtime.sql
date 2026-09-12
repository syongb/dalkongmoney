do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
  ) then
    raise exception 'Review existing realtime.messages policies before enabling household transaction broadcasts.';
  end if;
end;
$$;

create policy "household members can receive transaction changes"
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
        'household:' || public.household_members.household_id::text || ':transactions'
  )
);

create function private.broadcast_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid := coalesce(new.household_id, old.household_id);
  target_transaction_id uuid := coalesce(new.id, old.id);
begin
  perform realtime.send(
    jsonb_build_object(
      'transaction_id', target_transaction_id,
      'event_type', lower(tg_op)
    ),
    'transaction_changed',
    'household:' || target_household_id::text || ':transactions',
    true
  );

  return null;
end;
$$;

revoke all on function private.broadcast_transaction_change() from public;

create trigger broadcast_transaction_change
after insert or update or delete on public.transactions
for each row execute function private.broadcast_transaction_change();
