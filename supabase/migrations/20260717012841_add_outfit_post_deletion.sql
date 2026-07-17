-- Guests are anonymous (no auth), so "own post" is tracked via a random
-- token the browser generates once and stores locally, sent with every
-- post from that browser. It's never returned by any read RPC, so other
-- guests can't read it off someone else's post.
alter table public.outfit_posts add column guest_token text;

-- Hosts can delete any outfit post on their own event (moderation),
-- mirroring the SELECT policy added previously.
create policy outfit_posts_delete_own_event on public.outfit_posts
  for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = outfit_posts.event_id and e.host_id = auth.uid()
    )
  );

-- Recreate insert_outfit_post with the added guest_token param. The
-- parameter list changes, so this must be dropped first rather than
-- CREATE OR REPLACE'd, otherwise Postgres would leave both the old
-- 4-arg and new 5-arg versions defined as overloads.
drop function if exists public.insert_outfit_post(text, text, text, text);

create or replace function public.insert_outfit_post(
  p_code text, p_display_name text, p_image_url text, p_caption text default null, p_guest_token text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  select id into v_event_id from events where invite_code = p_code;
  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into outfit_posts (event_id, display_name, image_url, caption, guest_token)
  values (v_event_id, p_display_name, p_image_url, p_caption, p_guest_token)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_outfit_post(text, text, text, text, text) from public;
grant execute on function public.insert_outfit_post(text, text, text, text, text) to anon, authenticated;

-- Guest self-service delete: verifies the post belongs to the event
-- named by the code AND was created with a matching guest_token.
create or replace function public.delete_own_outfit_post(
  p_code text, p_post_id uuid, p_guest_token text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_deleted int;
begin
  delete from outfit_posts op
  using events e
  where op.id = p_post_id
    and op.event_id = e.id
    and e.invite_code = p_code
    and op.guest_token = p_guest_token;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Post not found or not yours to delete';
  end if;
end;
$$;

revoke all on function public.delete_own_outfit_post(text, uuid, text) from public;
grant execute on function public.delete_own_outfit_post(text, uuid, text) to anon, authenticated;
