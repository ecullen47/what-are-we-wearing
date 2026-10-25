-- Pinned host notes, events with parts (a wedding with welcome drinks,
-- ceremony and brunch under it), and no new polls once an event is over.

-- Pinned host note ------------------------------------------------------

alter table public.events
  add column host_note text check (char_length(host_note) <= 500),
  add column host_note_updated_at timestamptz;

-- Stamp the note's time whenever its text changes, so guests see how
-- fresh it is without the app having to remember to set it.
create function public.stamp_host_note() returns trigger language plpgsql as $$
begin
  if new.host_note is distinct from old.host_note then
    new.host_note_updated_at := case when nullif(trim(new.host_note), '') is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger events_stamp_host_note
  before update of host_note on public.events
  for each row execute function public.stamp_host_note();

-- Event parts -------------------------------------------------------------

-- A part points at the event it belongs to. Deleting the parent leaves the
-- parts as ordinary events.
alter table public.events
  add column parent_event_id uuid references public.events(id) on delete set null;

create index events_parent_event_id_idx on public.events(parent_event_id);

-- One level only, and only between the same host's events. Runs as the
-- caller, so a parent the host can't see under RLS reads as not found.
create function public.check_event_parent() returns trigger language plpgsql as $$
declare
  v_parent_host uuid;
  v_grandparent uuid;
begin
  if new.parent_event_id is null then
    return new;
  end if;
  if new.parent_event_id = new.id then
    raise exception 'An event can''t be a part of itself';
  end if;
  select host_id, parent_event_id into v_parent_host, v_grandparent
  from public.events where id = new.parent_event_id;
  if v_parent_host is null or v_parent_host <> new.host_id then
    raise exception 'Parent event not found';
  end if;
  if v_grandparent is not null then
    raise exception 'A part can''t have parts of its own';
  end if;
  if exists (select 1 from public.events where parent_event_id = new.id) then
    raise exception 'An event with parts can''t become a part';
  end if;
  return new;
end;
$$;

create trigger events_check_parent
  before insert or update of parent_event_id on public.events
  for each row execute function public.check_event_parent();

-- Guest-facing reads --------------------------------------------------------

-- Adds the host note and the parent's name. Only the name: a guest invited
-- to just the brunch shouldn't learn the code for the whole celebration.
drop function if exists public.get_event_by_code(text);

create function public.get_event_by_code(p_code text)
returns table (
  id uuid, name text, event_date date, location text, event_type text,
  dress_code_text text, invite_code text, host_display_name text,
  show_invite_code_to_guests boolean,
  inspo_image_urls text[], required_colors text[], suggested_colors text[], off_limit_colors text[],
  color_notes text,
  host_note text, host_note_updated_at timestamptz,
  parent_name text
) language sql security definer set search_path = public as $$
  select e.id, e.name, e.event_date, e.location, e.event_type, e.dress_code_text, e.invite_code, e.host_display_name,
         e.show_invite_code_to_guests,
         e.inspo_image_urls, e.required_colors, e.suggested_colors, e.off_limit_colors,
         e.color_notes,
         e.host_note, e.host_note_updated_at,
         p.name
  from events e
  left join events p on p.id = e.parent_event_id
  where e.invite_code = p_code;
$$;

revoke all on function public.get_event_by_code(text) from public;
grant execute on function public.get_event_by_code(text) to anon, authenticated;

-- The parts of an event, for guests holding the parent's code. Knowing the
-- parent's code is what grants access to all of its parts.
create function public.get_event_parts_by_code(p_code text)
returns table (
  invite_code text, name text, event_date date, location text, event_type text,
  dress_code_text text, cover_image_url text
) language sql security definer set search_path = public as $$
  select c.invite_code, c.name, c.event_date, c.location, c.event_type,
         c.dress_code_text, c.inspo_image_urls[1]
  from events c
  join events p on p.id = c.parent_event_id
  where p.invite_code = p_code
  order by c.event_date nulls last, c.name;
$$;

revoke all on function public.get_event_parts_by_code(text) from public;
grant execute on function public.get_event_parts_by_code(text) to anon, authenticated;

-- No new polls after the event ------------------------------------------------

-- Once the event is over, its page becomes a keepsake of what everyone wore:
-- outfit posts are still welcome but there's nothing left to vote on. The
-- day of grace covers guests whose local date is behind UTC.
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
  if v_event_date < current_date - 1 then
    raise exception 'This event is over, so polls are closed';
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
