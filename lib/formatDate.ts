// event_date comes from Postgres as a plain 'YYYY-MM-DD' string. Passing that
// straight to `new Date()` parses it as UTC midnight, which shows up as the
// previous day for anyone west of UTC (i.e. all of the US). Build the date
// from its parts instead so it stays on the right day in local time.
export function formatEventDate(value: string | null | undefined): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
