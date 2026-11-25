-- Base schema for a fresh project. Follow immediately with stage3.sql.
begin;

create schema if not exists rfr_private;
revoke all on schema rfr_private from public, anon, authenticated;

create table public.rfr_participants (
  participant text primary key check (participant in ('dave', 'kate')),
  goal_km numeric not null default 100 check (goal_km > 0 and goal_km <= 10000 and scale(goal_km) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.rfr_participants (participant) values ('dave'), ('kate');

create table rfr_private.account_links (
  participant text primary key references public.rfr_participants(participant),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table rfr_private.account_links enable row level security;
revoke all on rfr_private.account_links from public, anon, authenticated;

create table public.rfr_runs (
  id uuid primary key default gen_random_uuid(),
  participant text not null references public.rfr_participants(participant),
  run_date date not null check (run_date between date '2026-12-01' and date '2026-12-31'),
  distance_km numeric not null check (distance_km > 0 and distance_km <= 1000 and scale(distance_km) <= 3),
  duration_seconds integer check (duration_seconds between 1 and 359999),
  elevation_m integer check (elevation_m between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rfr_runs_chronology on public.rfr_runs (participant, run_date, created_at);

create function rfr_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function rfr_private.touch_updated_at() from public, anon, authenticated;
create trigger rfr_participant_updated before update on public.rfr_participants
for each row execute function rfr_private.touch_updated_at();
create trigger rfr_run_updated before update on public.rfr_runs
for each row execute function rfr_private.touch_updated_at();

-- The caller learns only their own participant slug. A caller cannot supply a user ID.
create function public.rfr_my_participant()
returns text language sql stable security definer set search_path = '' as $$
  select participant from rfr_private.account_links where user_id = (select auth.uid());
$$;
revoke all on function public.rfr_my_participant() from public, anon, authenticated;
grant execute on function public.rfr_my_participant() to authenticated;

alter table public.rfr_participants enable row level security;
alter table public.rfr_runs enable row level security;
revoke all on public.rfr_participants, public.rfr_runs from public, anon, authenticated;
grant select (participant, goal_km) on public.rfr_participants to anon, authenticated;
grant select (id, participant, run_date, distance_km, duration_seconds, elevation_m, created_at, updated_at)
  on public.rfr_runs to anon, authenticated;
grant insert (id, participant, run_date, distance_km, duration_seconds, elevation_m),
  update (run_date, distance_km, duration_seconds, elevation_m), delete
  on public.rfr_runs to authenticated;

create policy rfr_public_participants on public.rfr_participants
for select to anon, authenticated using (true);
create policy rfr_public_runs on public.rfr_runs
for select to anon, authenticated using (true);
create policy rfr_owner_insert on public.rfr_runs
for insert to authenticated with check (participant = (select public.rfr_my_participant()));
create policy rfr_owner_update on public.rfr_runs
for update to authenticated using (participant = (select public.rfr_my_participant()))
with check (participant = (select public.rfr_my_participant()));
create policy rfr_owner_delete on public.rfr_runs
for delete to authenticated using (participant = (select public.rfr_my_participant()));

-- One consistent public snapshot. Explicit fields keep account links and other data out of the response.
create function public.rfr_dashboard()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant', p.participant, 'goal_km', p.goal_km, 'runs',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'run_date', r.run_date, 'distance_km', r.distance_km,
      'duration_seconds', r.duration_seconds, 'elevation_m', r.elevation_m, 'updated_at', r.updated_at
    ) order by r.run_date, r.created_at, r.id), '[]'::jsonb)
    from public.rfr_runs r where r.participant = p.participant)
  ) order by p.participant), '[]'::jsonb)
  from public.rfr_participants p;
$$;
revoke all on function public.rfr_dashboard() from public, anon, authenticated;
grant execute on function public.rfr_dashboard() to anon, authenticated;

commit;
