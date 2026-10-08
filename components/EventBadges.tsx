import { countdownLabel, daysUntil } from '@/lib/formatDate'
import { eventTypeLabel, eventTypeTint } from '@/lib/eventTypes'

// Small pills shown on dashboard cards and the event page header:
// the event type, and how soon it is ("In 12 days", "Today!", "Past").
export default function EventBadges({ type, date }: { type: string | null; date: string | null }) {
  const countdown = countdownLabel(date)
  const days = daysUntil(date)
  const soon = days !== null && days >= 0 && days <= 7

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${eventTypeTint(type)}`}
      >
        {eventTypeLabel(type)}
      </span>
      {countdown && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            days !== null && days < 0
              ? 'bg-stone-line/60 text-stone-muted'
              : soon
                ? 'bg-terracotta text-cream'
                : 'bg-terracotta-light text-terracotta-dark'
          }`}
        >
          {countdown}
        </span>
      )}
    </div>
  )
}
