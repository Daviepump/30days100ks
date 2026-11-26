begin;

-- Keep rehearsal rows available to administrators while excluding them from public totals.
create policy rfr_challenge_runs on public.rfr_runs as restrictive
  for select to anon, authenticated
  using (created_at >= timestamptz '2026-12-01 00:00:00 Australia/Sydney');

create function rfr_private.require_started_run_date()
returns trigger language plpgsql set search_path='' as $$
declare
  sydney_today date := (now() at time zone 'Australia/Sydney')::date;
begin
  if sydney_today < date '2026-12-01' or new.run_date > sydney_today then
    raise check_violation using message = 'Runs can be saved after launch and only for dates that have started in Sydney.';
  end if;
  return new;
end;
$$;

create trigger rfr_run_date_started before insert or update of run_date on public.rfr_runs
  for each row execute function rfr_private.require_started_run_date();

commit;
