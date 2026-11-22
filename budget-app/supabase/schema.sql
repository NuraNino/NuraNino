-- 우리집 가계부: Supabase 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 보안 구조
-- * 가계부 내용은 기기에서 가계부 비밀번호로 암호화된 뒤 올라옵니다(종단간 암호화).
--   서버에는 암호문(ciphertext), 기록 종류(kind), 무작위 id, 수정 시각만 저장됩니다.
-- * 행 단위 접근 규칙(RLS): 가계부 구성원으로 로그인한 사용자만 그 가계부의 기록을 읽고 쓸 수 있습니다.
-- * 가계부 만들기·초대·참여는 아래 함수로만 할 수 있습니다(직접 INSERT 불가).

-- ---------- 표 ----------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kdf_salt text not null check (length(kdf_salt) between 16 and 64),
  kdf_iterations int not null check (kdf_iterations between 100000 and 10000000),
  key_check text not null check (length(key_check) < 512)
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members (user_id);

create table if not exists public.invites (
  code text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

create table if not exists public.records (
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('tx', 'inc', 'cat', 'pm', 'plan', 'rec', 'inst', 'skip', 'settings')),
  id text not null check (length(id) between 1 and 100),
  iv text not null default '' check (length(iv) <= 32),
  ciphertext text not null default '' check (length(ciphertext) <= 200000),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (household_id, kind, id)
);
create index if not exists records_household_updated_idx on public.records (household_id, updated_at);

-- 수정 시각·수정자는 서버가 기록 (기기 시계·위조 방지)
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- ---------- 구성원 확인 ----------
create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid());
$$;

-- ---------- 접근 규칙 (RLS) ----------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.records enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select to authenticated using (public.is_member(id));

drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select to authenticated using (public.is_member(household_id));
drop policy if exists members_leave on public.household_members;
create policy members_leave on public.household_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select to authenticated using (public.is_member(household_id));
drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated using (public.is_member(household_id));

drop policy if exists records_select on public.records;
create policy records_select on public.records for select to authenticated using (public.is_member(household_id));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated with check (public.is_member(household_id));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- 로그인하지 않은 사용자(anon)는 아무것도 못 함, 로그인 사용자도 필요한 권한만
revoke all on public.households, public.household_members, public.invites, public.records from anon, public;
revoke all on public.households, public.household_members, public.invites, public.records from authenticated;
grant select on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant select, delete on public.invites to authenticated;
grant select, insert, update on public.records to authenticated;

-- ---------- 함수: 가계부 만들기 / 초대 / 참여 ----------
create or replace function public.create_household(p_salt text, p_iterations int, p_key_check text)
returns public.households
language plpgsql security definer set search_path = public, pg_temp as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.households (created_by, kdf_salt, kdf_iterations, key_check)
    values (auth.uid(), p_salt, p_iterations, p_key_check) returning * into h;
  insert into public.household_members (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

create or replace function public.create_invite(p_household uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text;
begin
  if not public.is_member(p_household) then raise exception 'not a member'; end if;
  delete from public.invites where household_id = p_household and (expires_at < now() or used_at is not null);
  if (select count(*) from public.invites where household_id = p_household) >= 10 then
    raise exception 'too many open invites';
  end if;
  c := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.invites (code, household_id, created_by) values (c, p_household, auth.uid());
  return c;
end $$;

create or replace function public.accept_invite(p_code text)
returns public.households
language plpgsql security definer set search_path = public, pg_temp as $$
declare i public.invites; h public.households;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into i from public.invites where code = p_code for update;
  if not found or i.used_at is not null or i.expires_at < now() then
    raise exception 'invalid or expired invite';
  end if;
  insert into public.household_members (household_id, user_id, role)
    values (i.household_id, auth.uid(), 'member') on conflict do nothing;
  update public.invites set used_by = auth.uid(), used_at = now() where code = p_code;
  select * into h from public.households where id = i.household_id;
  return h;
end $$;

revoke all on function public.create_household(text, int, text) from public, anon;
revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.create_household(text, int, text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- ---------- 실시간 반영 ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
