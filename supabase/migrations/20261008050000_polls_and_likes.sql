-- "Help me choose" polls and likes on outfit posts.
--
-- Guests have no accounts, so voters and likers are identified by the same
-- per-browser guest token used for post ownership. These tables have RLS on
-- and no policies: all access goes through the security-definer functions
-- below, which never return tokens.

-- A poll is an outfit_posts row with is_poll = true and 2-3 options. Its
-- image_url is set to the first option so it still has a cover photo.
alter table public.outfit_posts add column is_poll boolean not null default false;

create table public.outfit_poll_options (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.outfit_posts(id) on delete cascade,
  image_url  text not null,
  position   smallint not null,
  created_at timestamptz not null default now()
);
create index outfit_poll_options_post_id_idx on public.outfit_poll_options (post_id);
alter table public.outfit_poll_options enable row level security;

-- One vote per voter per poll; voting again changes the vote.
create table public.outfit_poll_votes (
  post_id     uuid not null references public.outfit_posts(id) on delete cascade,
  option_id   uuid not null references public.outfit_poll_options(id) on delete cascade,
  voter_token text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, voter_token)
);
create index outfit_poll_votes_option_id_idx on public.outfit_poll_votes (option_id);
alter table public.outfit_poll_votes enable row level security;

create table public.outfit_likes (
  post_id     uuid not null references public.outfit_posts(id) on delete cascade,
  liker_token text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, liker_token)
);
alter table public.outfit_likes enable row level security;

-- Posts now carry likes and poll data. Vote counts are only returned to a
-- viewer who has voted or who posted the poll, so results stay hidden
-- until you vote, enforced here rather than just in the UI.
drop function if exists public.get_outfit_posts_by_code(text);

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

create function public.create_outfit_poll(
  p_code text, p_display_name text, p_guest_token text, p_image_urls text[], p_caption text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  if p_guest_token is null or length(p_guest_token) < 16 then
    raise exception 'Missing guest token';
  end if;
  if coalesce(cardinality(p_image_urls), 0) not between 2 and 3 then
    raise exception 'A poll needs 2 or 3 outfit options';
  end if;

  select id into v_event_id from events where invite_code = p_code;
  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into outfit_posts (event_id, display_name, image_url, caption, guest_token, is_poll)
  values (v_event_id, p_display_name, p_image_urls[1], p_caption, p_guest_token, true)
  returning id into v_id;

  insert into outfit_poll_options (post_id, image_url, position)
  select v_id, url, ord from unnest(p_image_urls) with ordinality as t(url, ord);

  return v_id;
end;
$$;

revoke all on function public.create_outfit_poll(text, text, text, text[], text) from public;
grant execute on function public.create_outfit_poll(text, text, text, text[], text) to anon, authenticated;

create function public.vote_on_poll(p_code text, p_option_id uuid, p_voter_token text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_post_id uuid;
begin
  if p_voter_token is null or length(p_voter_token) < 16 then
    raise exception 'Missing voter token';
  end if;

  select o.post_id into v_post_id
  from outfit_poll_options o
  join outfit_posts op on op.id = o.post_id
  join events e on e.id = op.event_id
  where o.id = p_option_id and e.invite_code = p_code and op.is_poll;
  if v_post_id is null then
    raise exception 'Poll option not found';
  end if;

  insert into outfit_poll_votes (post_id, option_id, voter_token)
  values (v_post_id, p_option_id, p_voter_token)
  on conflict (post_id, voter_token)
  do update set option_id = excluded.option_id, created_at = now();
end;
$$;

revoke all on function public.vote_on_poll(text, uuid, text) from public;
grant execute on function public.vote_on_poll(text, uuid, text) to anon, authenticated;

-- The poster picks the winner: the poll becomes a normal outfit post with
-- the chosen photo. Returns the other options' image URLs so the client
-- can delete them from storage (they're unreferenced once this returns).
create function public.pick_poll_winner(p_code text, p_post_id uuid, p_option_id uuid, p_guest_token text)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_image text;
  v_others text[];
begin
  select o.image_url into v_image
  from outfit_poll_options o
  join outfit_posts op on op.id = o.post_id
  join events e on e.id = op.event_id
  where o.id = p_option_id and o.post_id = p_post_id and e.invite_code = p_code
    and op.is_poll and op.guest_token = p_guest_token;
  if v_image is null then
    raise exception 'Poll not found or not yours';
  end if;

  select coalesce(array_agg(image_url), '{}') into v_others
  from outfit_poll_options where post_id = p_post_id and id <> p_option_id;

  update outfit_posts set image_url = v_image, is_poll = false where id = p_post_id;
  delete from outfit_poll_options where post_id = p_post_id; -- votes cascade

  return v_others;
end;
$$;

revoke all on function public.pick_poll_winner(text, uuid, uuid, text) from public;
grant execute on function public.pick_poll_winner(text, uuid, uuid, text) to anon, authenticated;

-- Returns whether the post is now liked by this token.
create function public.toggle_outfit_like(p_code text, p_post_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Missing token';
  end if;

  perform 1 from outfit_posts op join events e on e.id = op.event_id
  where op.id = p_post_id and e.invite_code = p_code;
  if not found then
    raise exception 'Post not found';
  end if;

  delete from outfit_likes where post_id = p_post_id and liker_token = p_token;
  if found then
    return false;
  end if;

  insert into outfit_likes (post_id, liker_token) values (p_post_id, p_token);
  return true;
end;
$$;

revoke all on function public.toggle_outfit_like(text, uuid, text) from public;
grant execute on function public.toggle_outfit_like(text, uuid, text) to anon, authenticated;

-- Poll option photos also count as "in use", so the orphan-cleanup storage
-- policy can't delete a photo that's still a live poll option.
create or replace function public.outfit_photo_in_use(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when substring(p_name from '^[0-9a-f-]{36}/[0-9a-f-]{36}') is null then true
    else exists (
      select 1 from outfit_posts
      where image_url like '%/outfit-posts/' || substring(p_name from '^[0-9a-f-]{36}/[0-9a-f-]{36}') || '%'
    ) or exists (
      select 1 from outfit_poll_options
      where image_url like '%/outfit-posts/' || substring(p_name from '^[0-9a-f-]{36}/[0-9a-f-]{36}') || '%'
    )
  end;
$$;
