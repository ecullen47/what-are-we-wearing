// The last name used anywhere, offered as a default for new events.
const LAST_GUEST_NAME_KEY = 'waww:guestName'
const GUEST_TOKEN_KEY = 'waww:guestToken'

const eventGuestNameKey = (eventId: string) => `waww:guestName:${eventId}`

// The name to prefill for an event: the one used there before, then the
// name from the invite link, then the last name used anywhere. A name
// already used for this event wins over the link, so a link forwarded
// around a group chat doesn't rename everyone.
export function getGuestName(eventId: string, fromLink?: string | null): string {
  if (typeof window === 'undefined') return fromLink ?? ''
  return (
    window.localStorage.getItem(eventGuestNameKey(eventId)) ??
    fromLink ??
    window.localStorage.getItem(LAST_GUEST_NAME_KEY) ??
    ''
  )
}

export function setGuestName(eventId: string, name: string): void {
  window.localStorage.setItem(eventGuestNameKey(eventId), name)
  window.localStorage.setItem(LAST_GUEST_NAME_KEY, name)
}

// Identifies this browser as the author of a post so it can later be
// deleted, without requiring guests to have an account.
export function getGuestToken(): string {
  let token = window.localStorage.getItem(GUEST_TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    window.localStorage.setItem(GUEST_TOKEN_KEY, token)
  }
  return token
}

function myPostsKey(eventId: string): string {
  return `waww:myPosts:${eventId}`
}

export function getMyPostIds(eventId: string): string[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(myPostsKey(eventId))
  return raw ? (JSON.parse(raw) as string[]) : []
}

export function addMyPostId(eventId: string, postId: string): void {
  const ids = getMyPostIds(eventId)
  window.localStorage.setItem(myPostsKey(eventId), JSON.stringify([...ids, postId]))
}

export function removeMyPostId(eventId: string, postId: string): void {
  const ids = getMyPostIds(eventId).filter((id) => id !== postId)
  window.localStorage.setItem(myPostsKey(eventId), JSON.stringify(ids))
}
