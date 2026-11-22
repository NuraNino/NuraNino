-- 접근 규칙(RLS) 테스트. 실패하면 예외로 중단됩니다.
\set ON_ERROR_STOP on
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), -- 남편
  ('00000000-0000-0000-0000-00000000000b'), -- 아내
  ('00000000-0000-0000-0000-00000000000c'); -- 다른 사람

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u, ''), false);
  if u is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

-- A: 가계부 만들기 + 기록 쓰기 + 초대
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t_h as select * from public.create_household('c2FsdHNhbHRzYWx0c2FsdA==', 600000, 'iv.ct');
grant select on t_h to authenticated, anon;
insert into public.records (household_id, kind, id, iv, ciphertext)
  select id, 'tx', 'r1', 'aXY=', 'Y2lwaGVy' from t_h;
do $$ begin
  if (select count(*) from public.records) <> 1 then raise exception 'A should see own record'; end if;
  if (select updated_by from public.records) <> '00000000-0000-0000-0000-00000000000a' then raise exception 'updated_by should be set by server'; end if;
end $$;
create temp table t_code as select public.create_invite((select id from t_h)) as code;
grant select on t_code to authenticated, anon;

-- C(다른 사람): 아무것도 못 봄, 쓰기·초대 불가
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.records) <> 0 then raise exception 'C must not see records'; end if;
  if (select count(*) from public.households) <> 0 then raise exception 'C must not see households'; end if;
  if (select count(*) from public.invites) <> 0 then raise exception 'C must not see invites'; end if;
  begin
    insert into public.records (household_id, kind, id) select id, 'tx', 'evil' from t_h;
    raise exception 'C insert should fail';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_invite((select id from t_h));
    raise exception 'C invite should fail';
  exception when raise_exception then
    if sqlerrm <> 'not a member' then raise; end if;
  end;
  begin
    insert into public.household_members values ((select id from t_h), '00000000-0000-0000-0000-00000000000c', 'member', now());
    raise exception 'C direct join should fail';
  exception when insufficient_privilege then null; end;
  update public.records set ciphertext = 'x'; -- RLS로 0행
  begin delete from public.records; raise exception 'delete should be denied';
  exception when insufficient_privilege then null; end;
end $$;
-- 위의 update/delete는 0행이어야 함 (A로 확인)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select ciphertext from public.records where id = 'r1') <> 'Y2lwaGVy' then raise exception 'C must not modify'; end if;
end $$;

-- 로그인 안 한 사용자(anon): 표·함수 모두 거부
select pg_temp.as_user(null);
do $$ begin
  begin perform count(*) from public.records; raise exception 'anon select should fail';
  exception when insufficient_privilege then null; end;
  begin perform public.accept_invite((select code from t_code)); raise exception 'anon accept should fail';
  exception when insufficient_privilege then null; end;
end $$;

-- B: 잘못된 코드 거부, 올바른 초대로 참여 → 기록 보임, 같은 초대 재사용 불가
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin perform public.accept_invite('wrong'); raise exception 'bad code should fail';
  exception when raise_exception then if sqlerrm <> 'invalid or expired invite' then raise; end if; end;
  if (select count(*) from public.records) <> 0 then raise exception 'B before join must not see'; end if;
  perform public.accept_invite((select code from t_code));
  if (select count(*) from public.records) <> 1 then raise exception 'B after join should see'; end if;
  if (select count(*) from public.household_members) <> 2 then raise exception 'B should see 2 members'; end if;
  update public.records set ciphertext = 'bmV3' where id = 'r1';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin perform public.accept_invite((select code from t_code)); raise exception 'used invite should fail';
  exception when raise_exception then if sqlerrm <> 'invalid or expired invite' then raise; end if; end;
end $$;

-- B가 나가면 더 이상 못 봄
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
delete from public.household_members where user_id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.records) <> 0 then raise exception 'B after leaving must not see'; end if;
end $$;

-- 만료된 초대 거부
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t_code2 as select public.create_invite((select id from t_h)) as code;
grant select on t_code2 to authenticated;
reset role;
update public.invites set expires_at = now() - interval '1 minute' where code = (select code from t_code2);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin perform public.accept_invite((select code from t_code2)); raise exception 'expired invite should fail';
  exception when raise_exception then if sqlerrm <> 'invalid or expired invite' then raise; end if; end;
end $$;

reset role;
select 'ALL RLS TESTS PASSED' as result;
