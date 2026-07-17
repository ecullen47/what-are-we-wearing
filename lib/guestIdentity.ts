const GUEST_NAME_KEY = 'waww:guestName'
const GUEST_TOKEN_KEY = 'waww:guestToken'

export function getGuestName(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(GUEST_NAME_KEY)
}

export function setGuestName(name: string): void {
  window.localStorage.setItem(GUEST_NAME_KEY, name)
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
