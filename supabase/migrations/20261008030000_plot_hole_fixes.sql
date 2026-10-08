-- 1. Hosts can delete their own events. outfit_posts and event_attendance
--    already cascade via their event_id foreign keys.
create policy events_delete_own on public.events
  for delete to authenticated
  using (host_id = auth.uid());

-- 2. Cap uploads at 10 MB and images only. Previously both buckets
--    accepted any file of any size, and outfit-posts is open to anonymous
--    uploads.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
    ]
where id in ('event-inspo', 'outfit-posts');

-- 3. A host shouldn't be able to "attend" their own event; it already
--    appears under Your Events. Clear out any existing self-attendance,
--    then block it going forward. The subquery runs under the caller's
--    RLS, where hosts can only see their own events, so for non-hosts it
--    finds nothing and the insert is allowed.
delete from public.event_attendance ea
using public.events e
where e.id = ea.event_id and e.host_id = ea.user_id;

drop policy event_attendance_insert_own on public.event_attendance;

create policy event_attendance_insert_own on public.event_attendance
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.events e
      where e.id = event_attendance.event_id and e.host_id = auth.uid()
    )
  );

-- 4. Outfit photos were left behind in storage when a post was deleted or
--    its photo replaced, because guests have no account to authorize a
--    storage delete. Instead, allow anyone to delete an outfit photo that
--    no post references any more: once a post is gone, its photo is just
--    an orphan, and removing it harms no one.
--
--    Object names are '<event uuid>/<upload uuid>-<filename>'. The two
--    uuids uniquely identify an upload and are URL-safe, so matching on
--    that prefix sidesteps URL-encoding of the filename in image_url.
--    Names not in that format are treated as in use, so they're never
--    deletable through this policy.
create or replace function public.outfit_photo_in_use(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when substring(p_name from '^[0-9a-f-]{36}/[0-9a-f-]{36}') is null then true
    else exists (
      select 1 from outfit_posts
      where image_url like '%/outfit-posts/' || substring(p_name from '^[0-9a-f-]{36}/[0-9a-f-]{36}') || '%'
    )
  end;
$$;

revoke all on function public.outfit_photo_in_use(text) from public;
grant execute on function public.outfit_photo_in_use(text) to anon, authenticated;

create policy outfit_photo_delete_unused on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'outfit-posts' and not public.outfit_photo_in_use(name));
