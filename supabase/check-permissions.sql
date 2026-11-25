-- Run in Supabase SQL Editor after setup and account mapping.
-- Uses temporary test rows and rolls every change back.
begin;

do $$
begin
  if (select count(*) from rfr_private.account_links) <> 2 then
    raise exception 'Map both Auth users before running this test.';
  end if;
end;
$$;

select set_config('rfr_test.dave_user',
  (select user_id::text from rfr_private.account_links where participant = 'dave'), true);
select set_config('rfr_test.kate_user',
  (select user_id::text from rfr_private.account_links where participant = 'kate'), true);
select set_config('rfr_test.dave_run', gen_random_uuid()::text, true);
select set_config('rfr_test.kate_run', gen_random_uuid()::text, true);

set local role anon;
do $$
begin
  if jsonb_array_length(public.rfr_dashboard()) <> 2 then
    raise exception 'Anonymous dashboard read did not return both participants.';
  end if;
  begin
    perform public.rfr_my_participant();
    raise exception 'Anonymous account mapping is exposed.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform user_id from rfr_private.account_links;
    raise exception 'Anonymous account links are exposed.';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rfr_runs (participant, run_date, distance_km) values ('dave', '2026-12-01', 5);
    raise exception 'Anonymous insert succeeded.';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.rfr_runs set distance_km = 10 where false;
    raise exception 'Anonymous update permission is enabled.';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.rfr_runs where false;
    raise exception 'Anonymous delete permission is enabled.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('rfr_test.dave_user'), true);
insert into public.rfr_runs (id, participant, run_date, distance_km)
values (current_setting('rfr_test.dave_run')::uuid, 'dave', '2026-12-01', 5);

do $$
begin
  if public.rfr_my_participant() is distinct from 'dave' then raise exception 'Dave mapping failed.'; end if;
  begin
    insert into public.rfr_runs (participant, run_date, distance_km) values ('kate', '2026-12-01', 5);
    raise exception 'Dave can insert for Kate.';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rfr_runs (id, participant, run_date, distance_km)
    values (current_setting('rfr_test.dave_run')::uuid, 'dave', '2026-12-01', 5);
    raise exception 'Duplicate ID was accepted.';
  exception when unique_violation then null;
  end;
  begin
    insert into public.rfr_runs (participant, run_date, distance_km) values ('dave', '2026-12-01', 0);
    raise exception 'Invalid distance was accepted.';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('rfr_test.kate_user'), true);
insert into public.rfr_runs (id, participant, run_date, distance_km, duration_seconds, elevation_m)
values (current_setting('rfr_test.kate_run')::uuid, 'kate', '2026-12-01', 5, 1500, 0);
do $$
begin
  if public.rfr_my_participant() is distinct from 'kate' then raise exception 'Kate mapping failed.'; end if;
  begin
    insert into public.rfr_runs (participant, run_date, distance_km) values ('dave', '2026-12-01', 5);
    raise exception 'Kate can insert for Dave.';
  exception when insufficient_privilege then null;
  end;
  update public.rfr_runs set distance_km = 7 where id = current_setting('rfr_test.dave_run')::uuid;
  if found then raise exception 'Kate can edit Dave’s run.'; end if;
  delete from public.rfr_runs where id = current_setting('rfr_test.dave_run')::uuid;
  if found then raise exception 'Kate can delete Dave’s run.'; end if;
  update public.rfr_runs set distance_km = 6 where id = current_setting('rfr_test.kate_run')::uuid;
  if not found then raise exception 'Kate cannot edit her own run.'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('rfr_test.dave_user'), true);
do $$
begin
  update public.rfr_runs set distance_km = 7 where id = current_setting('rfr_test.kate_run')::uuid;
  if found then raise exception 'Dave can edit Kate’s run.'; end if;
  delete from public.rfr_runs where id = current_setting('rfr_test.kate_run')::uuid;
  if found then raise exception 'Dave can delete Kate’s run.'; end if;
  update public.rfr_runs set distance_km = 6 where id = current_setting('rfr_test.dave_run')::uuid;
  if not found then raise exception 'Dave cannot edit his own run.'; end if;
  delete from public.rfr_runs where id = current_setting('rfr_test.dave_run')::uuid;
  if not found then raise exception 'Dave cannot delete his own run.'; end if;
end;
$$;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$
begin
  if public.rfr_my_participant() is not null then raise exception 'Unlinked account unexpectedly resolved.'; end if;
  begin
    insert into public.rfr_runs (participant, run_date, distance_km) values ('kate', '2026-12-01', 5);
    raise exception 'Unlinked account can write.';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('rfr_test.kate_user'), true);
do $$
begin
  delete from public.rfr_runs where id = current_setting('rfr_test.kate_run')::uuid;
  if not found then raise exception 'Kate cannot delete her own run.'; end if;
end;
$$;

rollback;
select 'RFR SQL permissions checks passed.' as result;
