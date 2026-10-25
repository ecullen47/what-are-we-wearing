import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { formatEventDate } from '@/lib/formatDate'
import ColorChip from '@/components/ColorChip'
import HangerMark from '@/components/HangerMark'
import PrintButton from '@/components/PrintButton'

type EventCard = {
  name: string | null
  event_date: string | null
  location: string | null
  dress_code_text: string | null
  host_display_name: string | null
  invite_code: string
  required_colors: string[]
  suggested_colors: string[]
  off_limit_colors: string[]
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://what-are-we-wearing-nu.vercel.app'

export const metadata = { title: 'Invite card', robots: { index: false, follow: false } }

// A printable card for tucking into paper invitations or propping up at the
// venue: the dress code and colors, plus a QR code and the invite code so
// guests can find the event.
export default async function InviteCardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { data } = await supabase.rpc('get_event_by_code', { p_code: code }).maybeSingle()
  const event = data as EventCard | null

  if (!event) {
    return (
      <div className="px-6 py-16 text-center">
        <h1 className="font-display text-3xl text-stone">Event not found</h1>
        <p className="mt-2 text-stone-muted">Double-check the invite code.</p>
      </div>
    )
  }

  const url = `${SITE_URL}/event/${event.invite_code}`
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#2b2420', light: '#0000' } })
  const when = [formatEventDate(event.event_date), event.location].filter(Boolean).join(' · ')
  const rules = [
    { title: 'Wear', colors: [...event.required_colors, ...event.suggested_colors] },
    { title: 'Please avoid', colors: event.off_limit_colors },
  ].filter((r) => r.colors.length > 0)

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/event/${event.invite_code}`} className="text-sm text-terracotta hover:underline">
          &larr; Back to the event
        </Link>
        <PrintButton />
      </div>

      {/* 5×7 inches, a standard invitation insert size. */}
      <article className="mx-auto flex aspect-5/7 w-full max-w-[5in] flex-col items-center rounded-2xl border border-stone-line bg-white px-8 py-9 text-center shadow-sm print:rounded-none print:border-dashed print:shadow-none"
        // Browsers skip background colors when printing unless told otherwise.
        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
        <HangerMark className="h-10 w-10 text-terracotta" />
        <p className="mt-2 text-[10px] font-medium tracking-[0.25em] text-terracotta uppercase">What are we wearing?</p>

        <h1 className="mt-5 font-display text-3xl leading-tight text-stone">{event.name?.trim() || "You're invited"}</h1>
        {when && <p className="mt-2 text-sm text-stone-muted">{when}</p>}

        {event.dress_code_text && (
          <div className="mt-5 w-full rounded-xl bg-blush px-4 py-3">
            <p className="text-[10px] font-medium tracking-[0.18em] text-blush-deep uppercase">Dress code</p>
            <p className="mt-0.5 font-display text-xl text-stone">{event.dress_code_text}</p>
          </div>
        )}

        {rules.map((r) => (
          <div key={r.title} className="mt-3">
            <p className="text-[10px] font-medium tracking-[0.18em] text-stone-muted uppercase">{r.title}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {r.colors.map((c) => (
                <ColorChip key={c} value={c} />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-auto flex flex-col items-center pt-6">
          <div className="h-28 w-28" aria-label="QR code for the event page" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-3 text-xs text-stone-muted">See what everyone&apos;s wearing and share your outfit</p>
          <p className="mt-1 text-sm text-stone">
            Scan, or enter code <strong className="tracking-widest">{event.invite_code}</strong>
          </p>
          <p className="mt-0.5 text-[11px] text-stone-muted">{SITE_URL.replace(/^https?:\/\//, '')}</p>
        </div>
      </article>
    </div>
  )
}
