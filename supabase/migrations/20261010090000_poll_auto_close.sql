-- "Help me choose" polls close themselves at a deadline, so a poster who
-- never picks a winner doesn't leave guests guessing what they'll wear.
--
-- At the deadline the option with the most votes wins (ties go to the
-- option posted first) and the poll becomes a normal outfit post, exactly
-- as if the poster had picked it. Closing happens lazily: whoever views the
-- event after the deadline triggers close_due_polls for that event. A poll
-- nobody looks at has nobody to mislead, and this avoids a global "close
-- everything" call that would hand any caller other events' photo URLs.

alter table public.outfit_posts add column poll_closes_at timestamptz;

-- Default deadline: midnight UTC at the start of the event day, i.e. the
-- evening before for US guests. Never sooner than 3 hours from now, so a
-- poll posted on the day still gets a voting window.
create function public.poll_default_close(p_event_date date)
returns timestamptz language sql stable set search_path = public as $$
  select greatest(
    coalesce(p_event_date, current_date + 1)::timestamp at time zone 'UTC',
    now() + interval '3 hours'
  );
$$;

revoke all on function public.poll_default_close(date) from public;
revoke execute on function public.poll_default_close(date) from anon;

-- Polls that are already open get the default, but at least a day's notice.
update public.outfit_posts op
set poll_closes_at = greatest(public.poll_default_close(e.event_date), now() + interval '1 day')
from public.events e
where e.id = op.event_id and op.is_poll;

-- create_outfit_poll gains an optional deadline.
drop function if exists public.create_outfit_poll(text, text, text, text[], text);

create function public.create_outfit_poll(
  p_code text, p_display_name text, p_guest_token text, p_image_urls text[],
  p_caption text default null, p_closes_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_event_date date;
  v_id uuid;
begin
  if p_guest_token is null or length(p_guest_token) < 16 then
    raise exception 'Missing guest token';
  end if;
  if coalesce(cardinality(p_image_urls), 0) not between 2 and 3 then
    raise exception 'A poll needs 2 or 3 outfit options';
  end if;
  if p_closes_at is not null and p_closes_at < now() + interval '10 minutes' then
    raise exception 'Pick a voting deadline in the future';
  end if;

  select id, event_date into v_event_id, v_event_date from events where invite_code = p_code;
  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into outfit_posts (event_id, display_name, image_url, caption, guest_token, is_poll, poll_closes_at)
  values (
    v_event_id, p_display_name, p_image_urls[1], p_caption, p_guest_token, true,
    coalesce(p_closes_at, poll_default_close(v_event_date))
  )
  returning id into v_id;

  insert into outfit_poll_options (post_id, image_url, position)
  select v_id, url, ord from unnest(p_image_urls) with ordinality as t(url, ord);

  return v_id;
end;
$$;

revoke all on function public.create_outfit_poll(text, text, text, text[], text, timestamptz) from public;
grant execute on function public.create_outfit_poll(text, text, text, text[], text, timestamptz) to anon, authenticated;

-- Closes this event's polls whose deadline has passed. Returns the losing
-- options' image URLs so the caller can delete them from storage (they're
-- unreferenced once this returns). Anyone with the invite code can call it,
-- but it only ever does what the deadline already decided.
create function public.close_due_polls(p_code text)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_post_id uuid;
  v_winner uuid;
  v_image text;
  v_losers text[] := '{}';
begin
  for v_post_id in
    select op.id
    from outfit_posts op
    join events e on e.id = op.event_id
    where e.invite_code = p_code and op.is_poll and op.poll_closes_at <= now()
    for update of op skip locked
  loop
    select o.id, o.image_url into v_winner, v_image
    from outfit_poll_options o
    left join outfit_poll_votes pv on pv.option_id = o.id
    where o.post_id = v_post_id
    group by o.id, o.image_url, o.position
    order by count(pv.option_id) desc, o.position
    limit 1;

    continue when v_winner is null;

    v_losers := v_losers || coalesce(
      (select array_agg(image_url) from outfit_poll_options where post_id = v_post_id and id <> v_winner),
      '{}'
    );
    update outfit_posts set image_url = v_image, is_poll = false, poll_closes_at = null where id = v_post_id;
    delete from outfit_poll_options where post_id = v_post_id; -- votes cascade
  end loop;

  return v_losers;
end;
$$;

revoke all on function public.close_due_polls(text) from public;
grant execute on function public.close_due_polls(text) to anon, authenticated;

-- A poster picking the winner by hand clears the deadline too.
create or replace function public.pick_poll_winner(p_code text, p_post_id uuid, p_option_id uuid, p_guest_token text)
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

  update outfit_posts set image_url = v_image, is_poll = false, poll_closes_at = null where id = p_post_id;
  delete from outfit_poll_options where post_id = p_post_id; -- votes cascade

  return v_others;
end;
$$;

-- Posts now include each poll's deadline.
drop function if exists public.get_outfit_posts_by_code(text, text);

create function public.get_outfit_posts_by_code(p_code text, p_viewer_token text default null)
returns table (
  id uuid, display_name text, image_url text, caption text, colors text[], created_at timestamptz,
  is_poll boolean, like_count int, liked_by_me boolean,
  options jsonb, my_vote uuid, total_votes int, poll_closes_at timestamptz
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
    case when op.is_poll then op.poll_closes_at end
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
