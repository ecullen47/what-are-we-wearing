-- Let users leave an event they joined via invite code. Without this,
-- deletes on event_attendance were silently filtered to zero rows by RLS.
create policy event_attendance_delete_own on public.event_attendance
  for delete to authenticated
  using (user_id = auth.uid());
