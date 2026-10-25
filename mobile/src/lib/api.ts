import { supabase } from './supabase'
import { getGuestToken } from './guestIdentity'

// The same invite-code database functions the web app calls (see
// supabase/migrations and the tests in tests/db).

export type EventData = {
  id: string
  name: string
  event_date: string | null
  location: string | null
  event_type: string | null
  dress_code_text: string | null
  invite_code: string
  host_display_name: string | null
  show_invite_code_to_guests: boolean
  inspo_image_urls: string[]
  required_colors: string[]
  suggested_colors: string[]
  off_limit_colors: string[]
  color_notes: string | null
}

export type PollOption = { id: string; image_url: string; position: number; votes: number | null }

export type OutfitPost = {
  id: string
  display_name: string
  image_url: string
  caption: string | null
  colors: string[] | null
  created_at: string
  is_poll: boolean
  like_count: number
  liked_by_me: boolean
  options: PollOption[] | null
  my_vote: string | null
  total_votes: number | null
  poll_closes_at: string | null
}

// Invite codes are case-insensitive to type but stored upper-case.
export const normalizeCode = (code: string) => code.trim().toUpperCase()

export async function getEvent(code: string): Promise<EventData | null> {
  const { data, error } = await supabase.rpc('get_event_by_code', { p_code: code }).maybeSingle()
  if (error) throw error
  return (data as EventData | null) ?? null
}

export async function getPosts(code: string): Promise<OutfitPost[]> {
  const { data, error } = await supabase.rpc('get_outfit_posts_by_code', {
    p_code: code,
    p_viewer_token: getGuestToken(),
  })
  if (error) throw error
  return (data as OutfitPost[] | null) ?? []
}

export async function insertOutfitPost(args: {
  code: string
  name: string
  imageUrl: string
  caption: string | null
  colors: string[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('insert_outfit_post', {
    p_code: args.code,
    p_display_name: args.name,
    p_image_url: args.imageUrl,
    p_caption: args.caption,
    p_guest_token: getGuestToken(),
    p_colors: args.colors,
  })
  if (error) throw error
  return data as string
}

// Returns the new poll's id. closesAt null lets the server pick its default.
export async function createOutfitPoll(args: {
  code: string
  name: string
  imageUrls: string[]
  question: string | null
  closesAt: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_outfit_poll', {
    p_code: args.code,
    p_display_name: args.name,
    p_guest_token: getGuestToken(),
    p_image_urls: args.imageUrls,
    p_caption: args.question,
    p_closes_at: args.closesAt,
  })
  if (error) throw error
  return data as string
}

// A poll keeps its own photo and colors; only the name and question change.
export async function updateOwnPost(args: {
  code: string
  postId: string
  name: string
  imageUrl: string
  caption: string | null
  colors: string[]
}): Promise<void> {
  const { error } = await supabase.rpc('update_own_outfit_post', {
    p_code: args.code,
    p_post_id: args.postId,
    p_guest_token: getGuestToken(),
    p_display_name: args.name,
    p_image_url: args.imageUrl,
    p_caption: args.caption,
    p_colors: args.colors,
  })
  if (error) throw error
}

export async function deleteOwnPost(code: string, postId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_own_outfit_post', {
    p_code: code,
    p_post_id: postId,
    p_guest_token: getGuestToken(),
  })
  if (error) throw error
}

export async function toggleLike(code: string, postId: string): Promise<void> {
  const { error } = await supabase.rpc('toggle_outfit_like', {
    p_code: code,
    p_post_id: postId,
    p_token: getGuestToken(),
  })
  if (error) throw error
}

export async function voteOnPoll(code: string, optionId: string): Promise<void> {
  const { error } = await supabase.rpc('vote_on_poll', {
    p_code: code,
    p_option_id: optionId,
    p_voter_token: getGuestToken(),
  })
  if (error) throw error
}

// The poll's author picks the option they're wearing, which closes the
// poll. Returns the other options' photo URLs, now safe to delete.
export async function pickPollWinner(code: string, postId: string, optionId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('pick_poll_winner', {
    p_code: code,
    p_post_id: postId,
    p_option_id: optionId,
    p_guest_token: getGuestToken(),
  })
  if (error) throw error
  return (data as string[] | null) ?? []
}

// Returns the losing options' photo URLs, now safe to delete.
export async function closeDuePolls(code: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('close_due_polls', { p_code: code })
  if (error) throw error
  return (data as string[] | null) ?? []
}

// Public URLs look like .../storage/v1/object/public/outfit-posts/<eventId>/<file>
export async function removeOutfitPhotos(urls: string[]): Promise<void> {
  const marker = '/object/public/outfit-posts/'
  const paths = urls
    .map((url) => {
      const i = url.indexOf(marker)
      return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
    })
    .filter((p): p is string => !!p)
  // Best effort, as on the web: a failed cleanup just leaves an unused file.
  if (paths.length) await supabase.storage.from('outfit-posts').remove(paths)
}
