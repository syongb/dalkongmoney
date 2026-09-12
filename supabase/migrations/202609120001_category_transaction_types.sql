alter table public.categories add column type text;

update public.categories set type = 'expense';

alter table public.categories
  alter column type set not null,
  add constraint categories_type_check check (type in ('expense', 'income'));

alter table public.categories
  drop constraint categories_household_id_name_key,
  add constraint categories_household_id_type_name_key
    unique (household_id, type, name),
  add constraint categories_household_id_id_type_key
    unique (household_id, id, type);

create index categories_household_type_active_sort_idx
  on public.categories (household_id, type, is_active, sort_order);

insert into public.categories (household_id, type, name, sort_order)
select households.id, 'income', defaults.name, defaults.sort_order
from public.households
cross join (values
  ('월급', 0),
  ('부수입', 1),
  ('용돈', 2),
  ('금융소득', 3),
  ('기타', 4)
) as defaults(name, sort_order)
on conflict (household_id, type, name) do nothing;

update public.transactions as transactions
set category_id = income_categories.id
from public.categories as old_categories
join public.categories as income_categories
  on income_categories.household_id = old_categories.household_id
 and income_categories.type = 'income'
 and income_categories.name = case
   when old_categories.name in ('월급', '부수입', '용돈', '금융소득', '기타')
     then old_categories.name
   else '기타'
 end
where transactions.type = 'income'
  and old_categories.household_id = transactions.household_id
  and old_categories.id = transactions.category_id;

alter table public.transactions
  drop constraint transactions_household_id_category_id_fkey,
  add constraint transactions_household_category_type_fkey
    foreign key (household_id, category_id, type)
    references public.categories(household_id, id, type);

create or replace function public.create_household(p_name text)
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

  insert into public.households (name)
  values (clean_name)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, current_user_id, 'owner');

  insert into public.categories (household_id, type, name, sort_order) values
    (new_household_id, 'expense', '식비', 0),
    (new_household_id, 'expense', '외식/카페', 1),
    (new_household_id, 'expense', '생활', 2),
    (new_household_id, 'expense', '교통', 3),
    (new_household_id, 'expense', '쇼핑', 4),
    (new_household_id, 'expense', '주거/고정비', 5),
    (new_household_id, 'expense', '여가', 6),
    (new_household_id, 'expense', '기타', 7),
    (new_household_id, 'income', '월급', 0),
    (new_household_id, 'income', '부수입', 1),
    (new_household_id, 'income', '용돈', 2),
    (new_household_id, 'income', '금융소득', 3),
    (new_household_id, 'income', '기타', 4);

  return new_household_id;
end;
$$;
