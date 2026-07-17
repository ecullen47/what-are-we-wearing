-- Hosts can view outfit posts for events they own (needed for the
-- dashboard's per-event outfit count, and generally reasonable: a host
-- should be able to see their own guests' posts directly, same as they
-- already can for their own events). Guests still only ever reach
-- outfit_posts through the RPCs added in the previous migration.
create policy outfit_posts_select_own_event on public.outfit_posts
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = outfit_posts.event_id and e.host_id = auth.uid()
    )
  );
