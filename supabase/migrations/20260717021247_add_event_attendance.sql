-- Tracks which events a logged-in user has joined by entering an invite
-- code, so the dashboard can list them under "Attending" separately from
-- events the user hosts.
create table public.event_attendance (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_attendance enable row level security;

create policy event_attendance_select_own on public.event_attendance
  for select to authenticated
  using (user_id = auth.uid());

create policy event_attendance_insert_own on public.event_attendance
  for insert to authenticated
  with check (user_id = auth.uid());

-- Attendees don't have a general SELECT policy on events (that's
-- intentionally restricted to hosts, to avoid enumeration — see the
-- get_event_by_code RPC). This RPC lets a user read event details only
-- for events they're already attending.
create or replace function public.get_my_attending_events()
returns table (
  event_id uuid, name text, event_date date, location text, invite_code text, joined_at timestamptz
) language sql security definer set search_path = public as $$
  select e.id, e.name, e.event_date, e.location, e.invite_code, ea.joined_at
  from event_attendance ea
  join events e on e.id = ea.event_id
  where ea.user_id = auth.uid()
  order by ea.joined_at desc;
$$;

revoke all on function public.get_my_attending_events() from public;
grant execute on function public.get_my_attending_events() to authenticated;
