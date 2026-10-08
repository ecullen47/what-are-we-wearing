-- Public inspo gallery, plus the storage lockdown it requires.

-- ---------------------------------------------------------------------
-- 1. Stop anyone from listing an event's photo folders.
--
-- Photo URLs contain the event's id (<event id>/<file>). The old public
-- SELECT policies let anyone who knew that id list every file in the
-- folder. Only invited guests saw those URLs before, but the gallery
-- publishes them, which would expose photos nobody chose to share.
--
-- Both buckets are public, so <img src> public URLs keep working without
-- any SELECT policy. SELECT is still needed where the app lists or removes
-- files (Storage "remove" requires select + delete), so it's narrowed to:
--   - hosts, for their own events' folders (delete event, remove inspo)
--   - anyone, for outfit photos no post references (orphan cleanup), which
--     reveals nothing since those photos are no longer shown anywhere.
-- ---------------------------------------------------------------------
drop policy if exists inspo_select_public on storage.objects;
drop policy if exists outfit_photo_select_public on storage.objects;

create policy inspo_select_own_event on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-inspo'
    and (storage.foldername(name))[1] in (select id::text from public.events where host_id = auth.uid())
  );

create policy outfit_photo_select_own_event on storage.objects
  for select to authenticated
  using (
    bucket_id = 'outfit-posts'
    and (storage.foldername(name))[1] in (select id::text from public.events where host_id = auth.uid())
  );

create policy outfit_photo_select_unused on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'outfit-posts' and not public.outfit_photo_in_use(name));

-- ---------------------------------------------------------------------
-- 2. Two-level consent. A host opts the event in (its inspo becomes
--    public and guests may share). A guest outfit appears only if the
--    event is shared AND that guest opted the post in. Both default off.
-- ---------------------------------------------------------------------
alter table public.events add column share_publicly boolean not null default false;
alter table public.outfit_posts add column share_publicly boolean not null default false;

-- Guest-facing functions gain the share flags. Their parameters/return
-- columns change, so each is dropped and recreated.

drop function if exists public.get_event_by_code(text);

create function public.get_event_by_code(p_code text)
returns table (
  id uuid, name text, event_date date, location text, event_type text,
  dress_code_text text, invite_code text, host_display_name text,
  show_invite_code_to_guests boolean,
  inspo_image_urls text[], required_colors text[], suggested_colors text[], off_limit_colors text[],
  color_notes text, share_publicly boolean
) language sql security definer set search_path = public as $$
  select id, name, event_date, location, event_type, dress_code_text, invite_code, host_display_name,
         show_invite_code_to_guests,
         inspo_image_urls, required_colors, suggested_colors, off_limit_colors,
         color_notes, share_publicly
  from events where invite_code = p_code;
$$;

revoke all on function public.get_event_by_code(text) from public;
grant execute on function public.get_event_by_code(text) to anon, authenticated;

drop function if exists public.get_outfit_posts_by_code(text, text);

create function public.get_outfit_posts_by_code(p_code text, p_viewer_token text default null)
returns table (
  id uuid, display_name text, image_url text, caption text, colors text[], created_at timestamptz,
  is_poll boolean, like_count int, liked_by_me boolean,
  options jsonb, my_vote uuid, total_votes int, share_publicly boolean
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
    end,
    op.share_publicly
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

drop function if exists public.insert_outfit_post(text, text, text, text, text, text[]);

create function public.insert_outfit_post(
  p_code text, p_display_name text, p_image_url text,
  p_caption text default null, p_guest_token text default null, p_colors text[] default '{}',
  p_share_publicly boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  select id into v_event_id from events where invite_code = p_code;
  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into outfit_posts (event_id, display_name, image_url, caption, guest_token, colors, share_publicly)
  values (v_event_id, p_display_name, p_image_url, p_caption, p_guest_token,
          coalesce(p_colors, '{}'), coalesce(p_share_publicly, false))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_outfit_post(text, text, text, text, text, text[], boolean) from public;
grant execute on function public.insert_outfit_post(text, text, text, text, text, text[], boolean) to anon, authenticated;

drop function if exists public.update_own_outfit_post(text, uuid, text, text, text, text, text[]);

-- null for p_colors / p_share_publicly means "leave unchanged", so older
-- clients that don't send them can't reset them.
create function public.update_own_outfit_post(
  p_code text, p_post_id uuid, p_guest_token text,
  p_display_name text, p_image_url text, p_caption text default null, p_colors text[] default null,
  p_share_publicly boolean default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_updated int;
begin
  update outfit_posts op
  set display_name = p_display_name,
      image_url = p_image_url,
      caption = p_caption,
      colors = coalesce(p_colors, op.colors),
      share_publicly = coalesce(p_share_publicly, op.share_publicly)
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

revoke all on function public.update_own_outfit_post(text, uuid, text, text, text, text, text[], boolean) from public;
grant execute on function public.update_own_outfit_post(text, uuid, text, text, text, text, text[], boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. The gallery itself. Logged-in users only. Returns just the photo and
--    anonymous context (event type, dress code, colors): no event or
--    people's names, locations, dates, ids, or invite codes. Sharing is
--    checked at read time, so un-sharing hides items immediately.
--    Polls are excluded until a winner is picked.
-- ---------------------------------------------------------------------
create function public.get_public_gallery(
  p_event_type text default null, p_limit int default 48, p_offset int default 0
) returns table (
  kind text, image_url text, event_type text, dress_code text, colors text[], shared_at timestamptz
) language sql stable security definer set search_path = public as $$
  select * from (
    select 'inspo'::text, url, e.event_type, nullif(trim(e.dress_code_text), ''),
           coalesce(e.required_colors, '{}') || coalesce(e.suggested_colors, '{}'), e.created_at
    from events e
    cross join lateral unnest(e.inspo_image_urls) as url
    where e.share_publicly
      and (p_event_type is null or e.event_type = p_event_type)
    union all
    select 'outfit'::text, op.image_url, e.event_type, nullif(trim(e.dress_code_text), ''),
           op.colors, op.created_at
    from outfit_posts op
    join events e on e.id = op.event_id
    where e.share_publicly and op.share_publicly and not op.is_poll
      and (p_event_type is null or e.event_type = p_event_type)
  ) items(kind, image_url, event_type, dress_code, colors, shared_at)
  order by shared_at desc
  limit least(greatest(coalesce(p_limit, 48), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_public_gallery(text, int, int) from public;
grant execute on function public.get_public_gallery(text, int, int) to authenticated;
