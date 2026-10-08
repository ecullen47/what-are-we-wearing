-- Replace the cross-event public gallery with a per-event gallery tab
-- (built client-side from data guests can already see on the event page).
-- Removes the gallery function and both share_publicly flags, returning
-- the guest RPCs to their pre-gallery shape.
--
-- Kept from the gallery work: the storage SELECT lockdown (anyone could
-- list an event's photo folder) and the anon revoke on
-- get_my_attending_events. Those were security fixes in their own right.
--
-- Apply only after the app code that stops sending p_share_publicly is
-- deployed; earlier clients pass that parameter and would fail.

drop function if exists public.get_public_gallery(text, int, int);

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

drop function if exists public.get_outfit_posts_by_code(text, text);

create function public.get_outfit_posts_by_code(p_code text, p_viewer_token text default null)
returns table (
  id uuid, display_name text, image_url text, caption text, colors text[], created_at timestamptz,
  is_poll boolean, like_count int, liked_by_me boolean,
  options jsonb, my_vote uuid, total_votes int
) language sql stable security definer set search_path = public as $$
  select
    op.id, op.display_name, op.image_url, op.caption, op.colors, op.created_at,
    op.is_poll,
    (select count(*)::int from outfit_likes l where l.post_id = op.id),
    (p_viewer_token is not null
      and exists (select 1 from outfit_likes l where l.post_id = op.id and l.liker_token = p_viewer_token)),
    case when op.is_poll then (
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'image_url', o.image_url,
          'position', o.position,
          'votes', case when seen.visible
                     then (select count(*) from outfit_poll_votes pv where pv.option_id = o.id)
                   end
        ) order by o.position)
      from outfit_poll_options o where o.post_id = op.id
    ) end,
    mine.option_id,
    case when op.is_poll and seen.visible
      then (select count(*)::int from outfit_poll_votes pv where pv.post_id = op.id)
    end
  from outfit_posts op
  join events e on e.id = op.event_id
  left join lateral (
    select pv.option_id from outfit_poll_votes pv
    where pv.post_id = op.id and p_viewer_token is not null and pv.voter_token = p_viewer_token
  ) mine on true
  cross join lateral (
    select (mine.option_id is not null
            or (p_viewer_token is not null and op.guest_token = p_viewer_token)) as visible
  ) seen
  where e.invite_code = p_code
  order by op.created_at desc;
$$;

revoke all on function public.get_outfit_posts_by_code(text, text) from public;
grant execute on function public.get_outfit_posts_by_code(text, text) to anon, authenticated;

drop function if exists public.insert_outfit_post(text, text, text, text, text, text[], boolean);

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

drop function if exists public.update_own_outfit_post(text, uuid, text, text, text, text, text[], boolean);

-- p_colors null means "leave tags unchanged".
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

alter table public.events drop column if exists share_publicly;
alter table public.outfit_posts drop column if exists share_publicly;
