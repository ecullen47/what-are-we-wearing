-- Allow any future poll deadline instead of requiring 10+ minutes. The app
-- only offers 3 hours or more, and a very short deadline only affects the
-- poster's own poll; this lets the automated tests close a poll for real
-- (a deadline seconds away) instead of needing a backdoor to fake time.

create or replace function public.create_outfit_poll(
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
  if p_closes_at is not null and p_closes_at <= now() then
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
