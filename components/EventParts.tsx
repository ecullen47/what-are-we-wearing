import Link from 'next/link'
import EventBadges from '@/components/EventBadges'
import HangerMark from '@/components/HangerMark'
import { formatEventDate } from '@/lib/formatDate'

export type EventPart = {
  invite_code: string
  name: string | null
  event_date: string | null
  location: string | null
  event_type: string | null
  dress_code_text: string | null
  cover_image_url: string | null
}

// The parts of a bigger celebration (welcome drinks, ceremony, brunch),
// each with its own dress code and outfits. Shown on the parent event.
export default function EventParts({
  parts,
  parentCode,
  canAdd,
}: {
  parts: EventPart[]
  parentCode: string
  // The event's owner (not co-hosts) can add parts.
  canAdd: boolean
}) {
  // Until it has parts, hosts just get a quiet way to start adding them.
  if (parts.length === 0) {
    if (!canAdd) return null
    return (
      <p className="mt-4 text-sm text-stone-muted">
        A weekend of events?{' '}
        <Link href={`/create-event?part_of=${parentCode}`} className="text-terracotta hover:underline">
          Add events under this one
        </Link>{' '}
        (welcome drinks, ceremony, brunch), each with its own dress code.
      </p>
    )
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl text-stone">The events</h2>
      <p className="mt-1 text-sm text-stone-muted">Each has its own dress code. Pick one to see what everyone&apos;s wearing.</p>
      <div className="mt-4 space-y-3">
        {parts.map((part) => (
          <Link
            key={part.invite_code}
            href={`/event/${part.invite_code}`}
            className="group flex items-stretch overflow-hidden rounded-xl border border-stone-line bg-white transition-colors hover:border-terracotta"
          >
            <div className="flex w-24 shrink-0 items-center justify-center bg-cream-dark sm:w-32">
              {part.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={part.cover_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <HangerMark className="h-8 w-8 text-stone-muted/60" />
              )}
            </div>
            <div className="min-w-0 flex-1 px-4 py-3">
              <EventBadges type={part.event_type} date={part.event_date} />
              <p className="mt-1.5 truncate font-display text-xl text-stone group-hover:text-terracotta">
                {part.name?.trim() || 'Untitled event'}
              </p>
              <p className="text-sm text-stone-muted">
                {[formatEventDate(part.event_date), part.location].filter(Boolean).join(' · ')}
              </p>
              {part.dress_code_text && (
                <p className="mt-1 text-sm text-stone">
                  <span className="text-stone-muted">Dress code:</span> {part.dress_code_text}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {canAdd && (
        <Link
          href={`/create-event?part_of=${parentCode}`}
          className="mt-3 inline-block rounded-full border border-terracotta px-4 py-1.5 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light"
        >
          + Add an event to this
        </Link>
      )}
    </section>
  )
}
