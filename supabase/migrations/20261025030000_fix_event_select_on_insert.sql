-- Fix for 20261025020000_cohosts: creating an event reads the new row back
-- (insert ... returning), and the select policy's is_event_host() looks the
-- event up in a snapshot taken before the insert, so it couldn't see it and
-- the insert was refused. Check the row's own host_id first, as the policy
-- did before co-hosts, and only then ask about co-hosts.

drop policy "events_select_own" on public.events;
create policy "events_select_own" on public.events
  for select to authenticated using (host_id = auth.uid() or public.is_event_host(id));

drop policy "Hosts can update their own events" on public.events;
create policy "Hosts can update their own events" on public.events
  for update to authenticated
  using (host_id = auth.uid() or public.is_event_host(id))
  with check (host_id = auth.uid() or public.is_event_host(id));
