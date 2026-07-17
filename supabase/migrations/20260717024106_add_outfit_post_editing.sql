-- Same ownership model as delete_own_outfit_post: verifies the post
-- belongs to the event named by the code AND was created with a
-- matching guest_token before allowing the update.
create or replace function public.update_own_outfit_post(
  p_code text, p_post_id uuid, p_guest_token text,
  p_display_name text, p_image_url text, p_caption text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_updated int;
begin
  update outfit_posts op
  set display_name = p_display_name,
      image_url = p_image_url,
      caption = p_caption
  from events e
  where op.id = p_post_id
    and op.event_id = e.id
    and e.invite_code = p_code
    and op.guest_token = p_guest_token;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Post not found or not yours to edit';
  end if;
end;
$$;

revoke all on function public.update_own_outfit_post(text, uuid, text, text, text, text) from public;
grant execute on function public.update_own_outfit_post(text, uuid, text, text, text, text) to anon, authenticated;
