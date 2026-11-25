-- Apply after stage3.sql. Existing runners remain public by default.
begin;

alter table public.rfr_participants add column visible boolean not null default true;
grant select (visible) on public.rfr_participants to anon, authenticated;

alter policy rfr_public_participants on public.rfr_participants
  using (active and visible);
alter policy rfr_public_runs on public.rfr_runs
  using (exists (
    select 1 from public.rfr_participants p
    where p.participant = rfr_runs.participant and p.active and p.visible
  ));

create function public.rfr_set_visibility(runner_id text, is_visible boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from rfr_private.admins where user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  update public.rfr_participants set visible=is_visible where participant=runner_id;
  return found;
end;
$$;
revoke all on function public.rfr_set_visibility(text,boolean) from public, anon, authenticated;
grant execute on function public.rfr_set_visibility(text,boolean) to authenticated;
commit;
