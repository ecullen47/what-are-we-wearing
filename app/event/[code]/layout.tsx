import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { formatEventDate } from '@/lib/formatDate'

type EventMeta = {
  name: string
  event_date: string | null
  location: string | null
  dress_code_text: string | null
  host_display_name: string | null
}

// Gives invite links a useful preview when texted or posted ("Sarah's
// Wedding · Sat, Jun 6 · Dress code: Cocktail") instead of the generic
// site title. Only people who already have the link see the preview.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  // Invite-only pages: keep them out of search engines either way.
  const robots = { index: false, follow: false }

  const { data } = await supabase.rpc('get_event_by_code', { p_code: code }).maybeSingle()
  const event = data as EventMeta | null
  if (!event) return { title: 'Event not found', robots }

  const title = event.name?.trim() || "You're invited"
  const when = [formatEventDate(event.event_date), event.location].filter(Boolean).join(' · ')
  const description = [
    event.host_display_name ? `Hosted by ${event.host_display_name}.` : "You're invited.",
    when ? `${when}.` : '',
    event.dress_code_text ? `Dress code: ${event.dress_code_text}.` : '',
    "See what everyone's wearing.",
  ]
    .filter(Boolean)
    .join(' ')

  // Setting openGraph here replaces (not merges with) the root's, which
  // drops the inherited preview image, so point back to it explicitly.
  const images = ['/opengraph-image']

  return {
    title,
    description,
    robots,
    openGraph: { title, description, images },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children
}
