-- Run as the SQL Editor owner after both schema scripts. All test data rolls back.
begin;
do $$
begin
  if not exists (select 1 from rfr_private.admins) then raise exception 'Allowlist an administrator before running this test'; end if;
end;
$$;
select set_config('rfr_test.admin',(select user_id::text from rfr_private.admins order by user_id limit 1),true);
select set_config('rfr_test.run',gen_random_uuid()::text,true);

set local role anon;
do $$
begin
  if jsonb_typeof(public.rfr_dashboard()) <> 'array' then raise exception 'Public dashboard read failed'; end if;
  begin
    perform public.rfr_manage('admin.list','{}');
    raise exception 'Anonymous access to privileged RPC';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rfr_runs(participant,run_date,distance_km) values('dave','2026-12-01',5);
    raise exception 'Anonymous insert succeeded';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform public.rfr_manage('admin.list','{}');
    raise exception 'Authenticated access to privileged RPC';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rfr_runs(participant,run_date,distance_km) values('dave','2026-12-01',5);
    raise exception 'Authenticated direct insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.rfr_runs set distance_km=3 where false;
    raise exception 'Authenticated direct update permitted';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.rfr_runs where false;
    raise exception 'Authenticated direct delete permitted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role service_role;
do $$
declare
  admin uuid := current_setting('rfr_test.admin')::uuid;
  runner text;
  entry jsonb;
  run_id text := current_setting('rfr_test.run');
  write_args jsonb;
  link text := repeat('a',64);
  session_a text := repeat('b',64);
  session_b text := repeat('d',64);
  other text;
begin
  if public.rfr_manage('admin.list','{}',gen_random_uuid()) is not null then
    raise exception 'Unlisted admin admitted';
  end if;
  runner := public.rfr_manage('admin.create',jsonb_build_object('display_name','Test runner','accent','#123456','new_hash',link),admin)->>'participant';
  if runner is null then raise exception 'Could not create participant'; end if;
  other := public.rfr_manage('admin.create',jsonb_build_object('display_name','Test other','new_hash',repeat('e',64)),admin)->>'participant';
  if public.rfr_manage('exchange',jsonb_build_object('token_hash',repeat('f',64),'session_hash',session_a)) is not null then
    raise exception 'Invalid link admitted';
  end if;
  if public.rfr_manage('exchange',jsonb_build_object('token_hash',link,'session_hash',session_a)) is null then
    raise exception 'Valid link denied';
  end if;
  perform public.rfr_manage('exchange',jsonb_build_object('token_hash',repeat('e',64),'session_hash',session_b));
  write_args := jsonb_build_object('session_hash',session_a,'id',run_id,'run_date','2026-12-25','distance_km',5);
  entry := public.rfr_manage('participant.save',write_args || jsonb_build_object('participant',other));
  if entry->>'participant' is distinct from runner then raise exception 'Participant identity accepted from request'; end if;
  if public.rfr_manage('participant.save',write_args) is distinct from entry then raise exception 'Duplicate retry was not idempotent'; end if;
  entry := public.rfr_manage('participant.save',write_args || jsonb_build_object('updated_at',entry->>'updated_at','distance_km',6));
  if (entry->>'distance_km')::numeric is distinct from 6 then raise exception 'Owner edit failed'; end if;
  if not (public.rfr_manage('participant.delete',jsonb_build_object('session_hash',session_b,'id',run_id,
    'updated_at',entry->>'updated_at'))->>'conflict')::boolean then raise exception 'Cross-participant delete succeeded'; end if;
  if not (public.rfr_manage('participant.delete',write_args || jsonb_build_object('updated_at',entry->>'updated_at'))->>'ok')::boolean then
    raise exception 'Owner delete failed';
  end if;
  perform public.rfr_manage('admin.revoke',jsonb_build_object('participant',runner),admin);
  if public.rfr_manage('participant.list',jsonb_build_object('session_hash',session_a)) is not null or
     public.rfr_manage('exchange',jsonb_build_object('token_hash',link,'session_hash',session_a)) is not null then
    raise exception 'Revoked link or session admitted';
  end if;
  if public.rfr_rate('test',1) is distinct from true or public.rfr_rate('test',1) is distinct from false then
    raise exception 'Rate limiting did not apply';
  end if;
end;
$$;
rollback;
select 'Stage 3 SQL checks passed.' as result;
