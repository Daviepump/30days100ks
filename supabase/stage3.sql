-- Apply after setup.sql. Existing participant IDs and runs are preserved.
begin;
alter table public.rfr_participants drop constraint rfr_participants_participant_check;
alter table public.rfr_participants
  add constraint rfr_participant_id check (participant ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  add column display_name text not null default 'Runner' check (char_length(btrim(display_name)) between 1 and 60),
  add column accent text not null default '#B9F94B' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  add column active boolean not null default true,
  add column display_order integer not null default 0 check (display_order between 0 and 100000);
update public.rfr_participants set display_name='Dave', display_order=10 where participant='dave';
update public.rfr_participants set display_name='Kate', accent='#D59BFF', display_order=20 where participant='kate';

drop policy rfr_owner_insert on public.rfr_runs;
drop policy rfr_owner_update on public.rfr_runs;
drop policy rfr_owner_delete on public.rfr_runs;
drop function public.rfr_my_participant();
drop table rfr_private.account_links;
revoke insert (id, participant, run_date, distance_km, duration_seconds, elevation_m),
  update (run_date, distance_km, duration_seconds, elevation_m), delete on public.rfr_runs from authenticated;

create table rfr_private.admins (user_id uuid primary key references auth.users on delete cascade);
create table rfr_private.links (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  participant text unique not null references public.rfr_participants(participant) on delete cascade
);
create table rfr_private.sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  link_hash text not null references rfr_private.links(token_hash) on delete cascade,
  expires_at timestamptz not null
);
create index on rfr_private.sessions(link_hash);
create table rfr_private.rate_windows (
  bucket text not null,
  minute timestamptz not null,
  hits integer not null,
  primary key (bucket, minute)
);
alter table rfr_private.admins enable row level security;
alter table rfr_private.links enable row level security;
alter table rfr_private.sessions enable row level security;
alter table rfr_private.rate_windows enable row level security;

drop policy rfr_public_participants on public.rfr_participants;
drop policy rfr_public_runs on public.rfr_runs;
grant select (display_name, accent, active, display_order) on public.rfr_participants to anon, authenticated;
create policy rfr_public_participants on public.rfr_participants for select to anon, authenticated using (active);
create policy rfr_public_runs on public.rfr_runs for select to anon, authenticated
  using (exists (select 1 from public.rfr_participants p where p.participant=rfr_runs.participant and p.active));

create or replace function public.rfr_dashboard()
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant',p.participant,'display_name',p.display_name,'accent',p.accent,'goal_km',p.goal_km,'runs',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'id',r.id,'run_date',r.run_date,'distance_km',r.distance_km,'duration_seconds',r.duration_seconds,
      'elevation_m',r.elevation_m,'updated_at',r.updated_at
    ) order by r.run_date,r.created_at,r.id),'[]'::jsonb) from public.rfr_runs r where r.participant=p.participant)
  ) order by p.display_order,p.participant),'[]'::jsonb)
  from public.rfr_participants p where p.active;
$$;

create function public.rfr_rate(bucket_key text, max_hits integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  insert into rfr_private.rate_windows as w values (bucket_key,date_trunc('minute',now()),1)
  on conflict (bucket,minute) do update set hits=least(w.hits+1,max_hits+1)
  returning hits into n;
  if random() < 0.01 then
    delete from rfr_private.rate_windows where minute < now()-interval '10 minutes';
    delete from rfr_private.sessions where expires_at < now();
  end if;
  return n <= max_hits;
end;
$$;

create function public.rfr_manage(action text, args jsonb, admin_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  runner text;
  profile public.rfr_participants;
  entry public.rfr_runs;
  link_digest text;
begin
  if action='exchange' then
    select l.token_hash into link_digest
    from rfr_private.links l join public.rfr_participants p using(participant)
    where l.token_hash=args->>'token_hash' and p.active for share of l,p;
    if not found then return null; end if;
    insert into rfr_private.sessions values (args->>'session_hash',link_digest,now()+interval '12 hours');
    return jsonb_build_object('ok',true);
  elsif action like 'participant.%' then
    select l.participant into runner
    from rfr_private.sessions s join rfr_private.links l on l.token_hash=s.link_hash
    join public.rfr_participants p on p.participant=l.participant
    where s.token_hash=args->>'session_hash' and s.expires_at>now() and p.active for share of l,p;
    if not found then return null; end if;
  elsif action='cloud.create' then
    -- This branch can only be reached through the service-role Edge Function.
    action := 'admin.create';
  elsif action like 'admin.%' then
    if not exists(select 1 from rfr_private.admins where user_id=admin_id) then return null; end if;
    runner := args->>'participant';
  else
    return null;
  end if;

  if action='admin.list' then
    return coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('has_link',
      exists(select 1 from rfr_private.links l where l.participant=p.participant))
      order by p.display_order,p.participant) from public.rfr_participants p),'[]'::jsonb);
  elsif action='admin.create' then
    insert into public.rfr_participants (participant, display_name, goal_km, accent, display_order)
    values (gen_random_uuid()::text, btrim(args->>'display_name'), coalesce((args->>'goal_km')::numeric,100),
      coalesce(args->>'accent','#B9F94B'),coalesce((args->>'display_order')::integer,100)) returning * into profile;
    insert into rfr_private.links values (args->>'new_hash',profile.participant);
    return to_jsonb(profile);
  elsif action='admin.profile' then
    update public.rfr_participants set display_name=btrim(args->>'display_name'),goal_km=(args->>'goal_km')::numeric,
      accent=args->>'accent',active=(args->>'active')::boolean,display_order=(args->>'display_order')::integer
    where participant=runner returning * into profile;
    if not found then return jsonb_build_object('conflict',true); end if;
    if not profile.active then delete from rfr_private.links where participant=runner; end if;
    return to_jsonb(profile);
  elsif action in ('admin.rotate','admin.revoke') then
    perform 1 from public.rfr_participants where participant=runner for update;
    if not found then return jsonb_build_object('conflict',true); end if;
    delete from rfr_private.links where participant=runner;
    if action='admin.rotate' then
      insert into rfr_private.links values (args->>'new_hash',runner);
    end if;
    return jsonb_build_object('ok',true);
  elsif action in ('participant.list','admin.runs') then
    return (select jsonb_build_object('display_name',p.display_name,'accent',p.accent,'runs',
      coalesce((select jsonb_agg(to_jsonb(r) order by r.run_date desc,r.created_at desc,r.id)
        from public.rfr_runs r where r.participant=runner),'[]'::jsonb))
      from public.rfr_participants p where p.participant=runner);
  elsif action in ('participant.save','admin.save') then
    if args->>'updated_at' is null then
      insert into public.rfr_runs (id,participant,run_date,distance_km,duration_seconds,elevation_m)
      values ((args->>'id')::uuid,runner,(args->>'run_date')::date,(args->>'distance_km')::numeric,
        (args->>'duration_seconds')::integer,(args->>'elevation_m')::integer)
      on conflict (id) do nothing returning * into entry;
      if not found then
        select * into entry from public.rfr_runs where id=(args->>'id')::uuid and participant=runner
          and run_date=(args->>'run_date')::date and distance_km=(args->>'distance_km')::numeric
          and duration_seconds is not distinct from (args->>'duration_seconds')::integer
          and elevation_m is not distinct from (args->>'elevation_m')::integer;
      end if;
    else
      update public.rfr_runs set run_date=(args->>'run_date')::date,distance_km=(args->>'distance_km')::numeric,
        duration_seconds=(args->>'duration_seconds')::integer,elevation_m=(args->>'elevation_m')::integer
      where id=(args->>'id')::uuid and participant=runner and updated_at=(args->>'updated_at')::timestamptz
      returning * into entry;
    end if;
    if not found then return jsonb_build_object('conflict',true); end if;
    return to_jsonb(entry);
  elsif action in ('participant.delete','admin.delete') then
    delete from public.rfr_runs where id=(args->>'id')::uuid and participant=runner
      and updated_at=(args->>'updated_at')::timestamptz;
    if not found then return jsonb_build_object('conflict',true); end if;
    return jsonb_build_object('ok',true);
  end if;
  return null;
end;
$$;
revoke all on function public.rfr_rate(text,integer),public.rfr_manage(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.rfr_rate(text,integer),public.rfr_manage(text,jsonb,uuid) to service_role;
commit;
