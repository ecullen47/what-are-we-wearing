// Reads event details another platform passed in a /create-event link, e.g.
//   /create-event?name=Maya's 30th&date=2026-11-14&location=Brooklyn&type=party
// Everything is optional and only prefills the form; the host reviews it
// before anything is saved.

export type CreatePrefill = {
  hostDisplayName?: string
  name?: string
  eventDate?: string
  location?: string
  eventType?: string
  dressCode?: string
}

export const EVENT_TYPE_VALUES = ['wedding', 'dinner', 'party', 'other'] as const

// Common types other platforms use, mapped onto ours.
const TYPE_ALIASES: Record<string, (typeof EVENT_TYPE_VALUES)[number]> = {
  reception: 'wedding',
  ceremony: 'wedding',
  brunch: 'dinner',
  lunch: 'dinner',
  rehearsal: 'dinner',
  birthday: 'party',
  engagement: 'party',
  shower: 'party',
  celebration: 'party',
}

function text(params: URLSearchParams, key: string, max: number): string | undefined {
  const value = params.get(key)?.trim()
  return value ? value.slice(0, max) : undefined
}

// Accepts 2026-11-14 or a full ISO timestamp (2026-11-14T19:00:00Z).
function date(params: URLSearchParams): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(params.get('date')?.trim() ?? '')
  if (!match) return undefined
  const [y, m, d] = match[1].split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  // Rejects impossible dates like 2026-02-31, which Date rolls over.
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d ? match[1] : undefined
}

function eventType(params: URLSearchParams): string | undefined {
  const value = params.get('type')?.trim().toLowerCase()
  if (!value) return undefined
  if ((EVENT_TYPE_VALUES as readonly string[]).includes(value)) return value
  return TYPE_ALIASES[value] ?? 'other'
}

export function readCreatePrefill(search: string): CreatePrefill {
  const params = new URLSearchParams(search)
  const prefill: CreatePrefill = {
    hostDisplayName: text(params, 'host', 100),
    name: text(params, 'name', 200),
    eventDate: date(params),
    location: text(params, 'location', 200),
    eventType: eventType(params),
    dressCode: text(params, 'dress', 200),
  }
  return Object.fromEntries(Object.entries(prefill).filter(([, v]) => v !== undefined)) as CreatePrefill
}

// Where to send someone after logging in: only paths on this site, never
// another origin (so the login page can't be used as an open redirect).
// Parsed the way the browser will parse it, which also catches tricks like
// "/\t/evil.com" (browsers drop the tab, leaving "//evil.com").
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/')) return null
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
