import { formatDeadline } from './formatDate'

// Poll rules shared by the web form and the mobile app.

// Matches the limits enforced by the create_outfit_poll database function.
export const MIN_POLL_OPTIONS = 2
export const MAX_POLL_OPTIONS = 3

const HOUR = 3_600_000

// Mirrors poll_default_close in the database: midnight UTC at the start of
// the event day (the evening before, for US guests), but at least 3 hours
// away. Only used to label the default; the server sets the real value.
function defaultPollClose(eventDate: string | null): Date {
  const match = eventDate && /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate)
  const now = new Date()
  const eventStart = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return new Date(Math.max(eventStart, now.getTime() + 3 * HOUR))
}

// Shorter voting windows a poster can pick instead of the default.
export const DEADLINE_CHOICES = [
  { value: '3h', label: 'In 3 hours', ms: 3 * HOUR },
  { value: '24h', label: 'In 24 hours', ms: 24 * HOUR },
  { value: '3d', label: 'In 3 days', ms: 72 * HOUR },
]

export type DeadlineOptions = { defaultLabel: string; choices: typeof DEADLINE_CHOICES }

// Reads the clock, so call it when poll mode opens rather than during
// render. Only offers windows that end before the default deadline.
export function pollDeadlineOptions(eventDate: string | null): DeadlineOptions {
  const byDefault = defaultPollClose(eventDate)
  return {
    defaultLabel: formatDeadline(byDefault),
    choices: DEADLINE_CHOICES.filter((c) => Date.now() + c.ms < byDefault.getTime()),
  }
}

// The closing time to send for a choice, or null to let the server apply
// its default.
export function pollClosesAt(choice: string): string | null {
  const picked = DEADLINE_CHOICES.find((c) => c.value === choice)
  return picked ? new Date(Date.now() + picked.ms).toISOString() : null
}
