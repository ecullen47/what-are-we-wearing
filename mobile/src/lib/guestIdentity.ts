import { store } from './localStore'
import * as Crypto from 'expo-crypto'

// Mirrors lib/guestIdentity.ts on the web. Guests have no account: a
// random token kept on the phone marks their posts, votes and likes as
// theirs.

const LAST_GUEST_NAME_KEY = 'waww:guestName'
const GUEST_TOKEN_KEY = 'waww:guestToken'
const RECENT_EVENTS_KEY = 'waww:recentEvents'
const eventGuestNameKey = (eventId: string) => `waww:guestName:${eventId}`
const myPostsKey = (eventId: string) => `waww:myPosts:${eventId}`

export function getGuestToken(): string {
  let token = store.getItem(GUEST_TOKEN_KEY)
  if (!token) {
    token = Crypto.randomUUID()
    store.setItem(GUEST_TOKEN_KEY, token)
  }
  return token
}

// The name used for this event before, else the last name used anywhere.
export function getGuestName(eventId: string): string {
  return store.getItem(eventGuestNameKey(eventId)) ?? store.getItem(LAST_GUEST_NAME_KEY) ?? ''
}

export function setGuestName(eventId: string, name: string): void {
  store.setItem(eventGuestNameKey(eventId), name)
  store.setItem(LAST_GUEST_NAME_KEY, name)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function getMyPostIds(eventId: string): string[] {
  return readJson<string[]>(myPostsKey(eventId), [])
}

export function addMyPostId(eventId: string, postId: string): void {
  store.setItem(myPostsKey(eventId), JSON.stringify([...getMyPostIds(eventId), postId]))
}

export function removeMyPostId(eventId: string, postId: string): void {
  store.setItem(myPostsKey(eventId), JSON.stringify(getMyPostIds(eventId).filter((id) => id !== postId)))
}

// Events opened on this phone, newest first, for the home screen.
export type RecentEvent = { code: string; name: string; eventDate: string | null; eventType: string | null }

export function getRecentEvents(): RecentEvent[] {
  return readJson<RecentEvent[]>(RECENT_EVENTS_KEY, [])
}

export function rememberEvent(event: RecentEvent): void {
  const rest = getRecentEvents().filter((e) => e.code !== event.code)
  store.setItem(RECENT_EVENTS_KEY, JSON.stringify([event, ...rest].slice(0, 20)))
}

export function forgetEvent(code: string): void {
  store.setItem(RECENT_EVENTS_KEY, JSON.stringify(getRecentEvents().filter((e) => e.code !== code)))
}
