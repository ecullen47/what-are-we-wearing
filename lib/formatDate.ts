// event_date comes from Postgres as a plain 'YYYY-MM-DD' string. Passing that
// straight to `new Date()` parses it as UTC midnight, which shows up as the
// previous day for anyone west of UTC (i.e. all of the US). Build the date
// from its parts instead so it stays on the right day in local time.
function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

export function formatEventDate(value: string | null | undefined): string {
  const date = parseLocalDate(value)
  if (!date) return value ?? ''
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Whole calendar days from today (local time) until the event; negative once
// it has passed. null if the date is missing or unparseable.
export function daysUntil(value: string | null | undefined): number | null {
  const date = parseLocalDate(value)
  if (!date) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

export function countdownLabel(value: string | null | undefined): string | null {
  const days = daysUntil(value)
  if (days === null) return null
  if (days < 0) return 'Past'
  if (days === 0) return 'Today!'
  if (days === 1) return 'Tomorrow'
  if (days <= 60) return `In ${days} days`
  const weeks = Math.round(days / 7)
  return `In ${weeks} weeks`
}
