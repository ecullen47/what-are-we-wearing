-- Let hosts delete inspo images from their own events' folders, so images
-- removed on the edit page don't linger in storage.
create policy inspo_delete_own_event on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-inspo'
    and (storage.foldername(name))[1] in (
      select id::text from public.events where host_id = auth.uid()
    )
  );
