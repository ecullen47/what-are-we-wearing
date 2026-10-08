-- Outfit color tags: guests tag up to 3 colors from the shared palette
-- (ids defined in lib/palette.ts) so the event page can warn about
-- off-limit colors and show which colors other guests are wearing.
alter table public.outfit_posts
  add column colors text[] not null default '{}'
  check (cardinality(colors) <= 3);

-- Hosts now pick required/suggested/off-limit colors from the same
-- palette; this free-text note keeps room for nuance ("no neon",
-- "bridesmaids are in dusty rose").
alter table public.events add column color_notes text;

-- The functions below change their return columns or parameters, which
-- CREATE OR REPLACE can't do, so each is dropped and recreated.

drop function if exists public.get_event_by_code(text);

create function public.get_event_by_code(p_code text)
returns table (
  id uuid, name text, event_date date, location text, event_type text,
  dress_code_text text, invite_code text, host_display_name text,
  show_invite_code_to_guests boolean,
  inspo_image_urls text[], required_colors text[], suggested_colors text[], off_limit_colors text[],
  color_notes text
) language sql security definer set search_path = public as $$
  select id, name, event_date, location, event_type, dress_code_text, invite_code, host_display_name,
         show_invite_code_to_guests,
         inspo_image_urls, required_colors, suggested_colors, off_limit_colors,
         color_notes
  from events where invite_code = p_code;
$$;

revoke all on function public.get_event_by_code(text) from public;
grant execute on function public.get_event_by_code(text) to anon, authenticated;

drop function if exists public.get_outfit_posts_by_code(text);

create function public.get_outfit_posts_by_code(p_code text)
returns table (
  id uuid, display_name text, image_url text, caption text, colors text[], created_at timestamptz
) language sql security definer set search_path = public as $$
  select op.id, op.display_name, op.image_url, op.caption, op.colors, op.created_at
  from outfit_posts op join events e on e.id = op.event_id
  where e.invite_code = p_code order by op.created_at desc;
$$;

revoke all on function public.get_outfit_posts_by_code(text) from public;
grant execute on function public.get_outfit_posts_by_code(text) to anon, authenticated;

drop function if exists public.insert_outfit_post(text, text, text, text, text);

create function public.insert_outfit_post(
  p_code text, p_display_name text, p_image_url text,
  p_caption text default null, p_guest_token text default null, p_colors text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  select id into v_event_id from events where invite_code = p_code;
  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into outfit_posts (event_id, display_name, image_url, caption, guest_token, colors)
  values (v_event_id, p_display_name, p_image_url, p_caption, p_guest_token, coalesce(p_colors, '{}'))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_outfit_post(text, text, text, text, text, text[]) from public;
grant execute on function public.insert_outfit_post(text, text, text, text, text, text[]) to anon, authenticated;

drop function if exists public.update_own_outfit_post(text, uuid, text, text, text, text);

-- p_colors null means "leave tags unchanged", so a client that doesn't
-- know about color tags can't wipe them by editing a caption.
create function public.update_own_outfit_post(
  p_code text, p_post_id uuid, p_guest_token text,
  p_display_name text, p_image_url text, p_caption text default null, p_colors text[] default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_updated int;
begin
  update outfit_posts op
  set display_name = p_display_name,
      image_url = p_image_url,
      caption = p_caption,
      colors = coalesce(p_colors, op.colors)
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

revoke all on function public.update_own_outfit_post(text, uuid, text, text, text, text, text[]) from public;
grant execute on function public.update_own_outfit_post(text, uuid, text, text, text, text, text[]) to anon, authenticated;
