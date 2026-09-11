create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  currency_code char(3) not null default 'KRW',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  sort_order smallint not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  unique (household_id, id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  amount bigint not null check (amount > 0),
  type text not null check (type in ('expense', 'income')),
  category_id uuid not null,
  merchant_name text null check (
    merchant_name is null
    or (merchant_name = btrim(merchant_name) and merchant_name <> '')
  ),
  memo text null,
  transaction_date date not null,
  created_by uuid not null,
  spent_by uuid null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_shared_spender_check check (
    (is_shared = false and spent_by is not null)
    or (is_shared = true and spent_by is null)
  ),
  foreign key (household_id, category_id)
    references public.categories(household_id, id),
  foreign key (household_id, created_by)
    references public.household_members(household_id, user_id),
  foreign key (household_id, spent_by)
    references public.household_members(household_id, user_id)
);

create index transactions_recent_idx
  on public.transactions (household_id, transaction_date desc, created_at desc);
create index transactions_merchant_idx
  on public.transactions (household_id, merchant_name, transaction_date desc);
create index transactions_category_idx
  on public.transactions (household_id, category_id);
create index transactions_spent_by_idx
  on public.transactions (household_id, spent_by);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_month date not null check (
    budget_month = date_trunc('month', budget_month)::date
  ),
  amount bigint not null check (amount >= 0),
  category_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, category_id)
    references public.categories(household_id, id)
);

create unique index budgets_household_month_unique_idx
  on public.budgets (household_id, budget_month)
  where category_id is null;
create unique index budgets_category_month_unique_idx
  on public.budgets (household_id, budget_month, category_id)
  where category_id is not null;

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null,
  expires_at timestamptz not null,
  accepted_by uuid null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  foreign key (household_id, created_by)
    references public.household_members(household_id, user_id),
  foreign key (household_id, accepted_by)
    references public.household_members(household_id, user_id),
  check ((accepted_by is null) = (accepted_at is null))
);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function private.set_updated_at();
create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function private.set_updated_at();

create function private.normalize_transaction_merchant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.merchant_name = nullif(btrim(new.merchant_name), '');
  return new;
end;
$$;

create trigger transactions_normalize_merchant
before insert or update of merchant_name on public.transactions
for each row execute function private.normalize_transaction_merchant();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_display_name text;
begin
  new_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if new_display_name = '' then
    new_display_name := split_part(coalesce(new.email, '사용자'), '@', 1);
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, new_display_name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create function private.shares_household(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs
      on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user_id
  );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.normalize_transaction_merchant() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_household_owner(uuid) from public;
revoke all on function private.shares_household(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
grant execute on function private.shares_household(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.household_invitations enable row level security;

create policy "members can view their household"
on public.households for select to authenticated
using (private.is_household_member(id));
create policy "owners can update their household"
on public.households for update to authenticated
using (private.is_household_owner(id))
with check (private.is_household_owner(id));

create policy "users can view self and household profiles"
on public.profiles for select to authenticated
using (id = auth.uid() or private.shares_household(id));
create policy "users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "members can view household membership"
on public.household_members for select to authenticated
using (private.is_household_member(household_id));

create policy "members can view categories"
on public.categories for select to authenticated
using (private.is_household_member(household_id));

create policy "members can view transactions"
on public.transactions for select to authenticated
using (private.is_household_member(household_id));
create policy "members can create their own transaction records"
on public.transactions for insert to authenticated
with check (private.is_household_member(household_id) and created_by = auth.uid());
create policy "members can update household transactions"
on public.transactions for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));
create policy "members can delete household transactions"
on public.transactions for delete to authenticated
using (private.is_household_member(household_id));

create policy "members can view budgets"
on public.budgets for select to authenticated
using (private.is_household_member(household_id));
create policy "members can create budgets"
on public.budgets for insert to authenticated
with check (private.is_household_member(household_id));
create policy "members can update budgets"
on public.budgets for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));
create policy "members can delete budgets"
on public.budgets for delete to authenticated
using (private.is_household_member(household_id));

revoke all on public.households, public.profiles, public.household_members,
  public.categories, public.transactions, public.budgets,
  public.household_invitations from anon, authenticated;
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.household_members, public.categories to authenticated;
grant select, delete on public.transactions to authenticated;
grant insert (household_id, amount, type, category_id, merchant_name, memo,
  transaction_date, created_by, spent_by, is_shared)
  on public.transactions to authenticated;
grant update (amount, type, category_id, merchant_name, memo,
  transaction_date, spent_by, is_shared)
  on public.transactions to authenticated;
grant select, delete on public.budgets to authenticated;
grant insert (household_id, budget_month, amount, category_id)
  on public.budgets to authenticated;
grant update (budget_month, amount, category_id)
  on public.budgets to authenticated;

create function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_household_id uuid;
  clean_name text := btrim(p_name);
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if clean_name = '' then raise exception '가계부 이름을 입력해주세요.'; end if;
  if exists (select 1 from public.household_members where user_id = current_user_id) then
    raise exception '이미 참여 중인 가계부가 있습니다.';
  end if;

  insert into public.households (name) values (clean_name) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, current_user_id, 'owner');
  insert into public.categories (household_id, name, sort_order) values
    (new_household_id, '식비', 0), (new_household_id, '외식/카페', 1),
    (new_household_id, '생활', 2), (new_household_id, '교통', 3),
    (new_household_id, '쇼핑', 4), (new_household_id, '주거/고정비', 5),
    (new_household_id, '여가', 6), (new_household_id, '기타', 7);
  return new_household_id;
end;
$$;

create function public.create_household_invitation()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  owner_household_id uuid;
  raw_token text;
begin
  select household_id into owner_household_id
  from public.household_members
  where user_id = current_user_id and role = 'owner';
  if owner_household_id is null then raise exception '가계부 관리자만 초대할 수 있습니다.'; end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.household_invitations
    (household_id, token_hash, created_by, expires_at)
  values
    (owner_household_id, extensions.digest(raw_token, 'sha256'), current_user_id, now() + interval '24 hours');
  return raw_token;
end;
$$;

create function public.accept_household_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_invitation public.household_invitations%rowtype;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if exists (select 1 from public.household_members where user_id = current_user_id) then
    raise exception '이미 참여 중인 가계부가 있습니다.';
  end if;

  select * into target_invitation
  from public.household_invitations
  where token_hash = extensions.digest(p_token, 'sha256')
    and accepted_at is null and revoked_at is null and expires_at > now()
  for update;
  if target_invitation.id is null then raise exception '초대 링크가 만료되었거나 이미 사용되었습니다.'; end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_invitation.household_id, current_user_id, 'member');
  update public.household_invitations
  set accepted_by = current_user_id, accepted_at = now()
  where id = target_invitation.id;
  return target_invitation.household_id;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.create_household_invitation() from public;
revoke all on function public.accept_household_invitation(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation() to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
