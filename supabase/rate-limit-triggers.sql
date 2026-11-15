-- Paste into Supabase Dashboard -> SQL Editor and run once.
-- Database-level limits: apply to the REST API AND the edge functions, so they cannot be bypassed.

-- Support tickets: max 3 per hour and 10 per day per user
create or replace function public.enforce_support_ticket_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hour int;
  v_day int;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('support:' || coalesce(new.user_id::text, new.contact_email, 'anon'))
  );

  select
    count(*) filter (where created_at > pg_catalog.now() - interval '1 hour'),
    count(*)
  into v_hour, v_day
  from public.support_tickets
  where created_at > pg_catalog.now() - interval '1 day'
    and (
      (new.user_id is not null and user_id = new.user_id)
      or (new.user_id is null and contact_email = new.contact_email)
    );

  if v_hour >= 3 then
    raise exception 'rate_limited: too many support tickets, please try again later'
      using errcode = 'P0001';
  end if;

  if v_day >= 10 then
    raise exception 'rate_limited: daily support ticket limit reached'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_support_tickets on public.support_tickets;
create trigger rate_limit_support_tickets
  before insert on public.support_tickets
  for each row execute function public.enforce_support_ticket_limits();

-- User reports: max 10 per hour per reporter; one web report per reporter+reported user per 24h
create or replace function public.enforce_user_report_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('report:' || coalesce(new.reporter_id::text, 'anon'))
  );

  if (
    select count(*)
    from public.user_reports
    where reporter_id = new.reporter_id
      and created_at > pg_catalog.now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited: too many reports, please try again later'
      using errcode = 'P0001';
  end if;

  if new.report_location = 'web' and exists (
    select 1
    from public.user_reports
    where reporter_id = new.reporter_id
      and reported_user_id = new.reported_user_id
      and report_location = 'web'
      and created_at > pg_catalog.now() - interval '24 hours'
  ) then
    raise exception 'rate_limited: you already reported this user recently'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_user_reports on public.user_reports;
create trigger rate_limit_user_reports
  before insert on public.user_reports
  for each row execute function public.enforce_user_report_limits();

-- Trigger functions must never be callable as RPCs
revoke execute on function public.enforce_support_ticket_limits() from public, anon, authenticated;
revoke execute on function public.enforce_user_report_limits() from public, anon, authenticated;
