import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'
import { formatEventDate } from '@/lib/formatDate'
import { resolveColor } from '@/lib/palette'

// The link preview for one event: its name, date, dress code, colors and
// first inspo photo, so a texted invite shows what the event is about.
// Only people who already have the link see it.
export const alt = "An event invitation on What Are We Wearing?"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Re-render now and then so a host's edits reach new previews. (Apps that
// already fetched a preview keep their own copy.)
export const revalidate = 600

type EventPreview = {
  name: string | null
  event_date: string | null
  location: string | null
  dress_code_text: string | null
  host_display_name: string | null
  inspo_image_urls: string[]
  required_colors: string[]
  suggested_colors: string[]
}

const CREAM = '#faf3ec'
const STONE = '#2b2420'
const MUTED = '#7a6f63'
const TERRACOTTA = '#bc5b3a'

// The image renderer only draws JPEG and PNG, so other formats (an
// unconverted HEIC, say) are skipped rather than breaking the preview.
async function loadPhoto(url: string | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

// Swatch backgrounds the renderer can draw: it has no conic gradients, so
// "Multi" becomes a linear one through the same colors.
function swatchStyle(value: string): React.CSSProperties {
  const swatch = resolveColor(value)?.swatch ?? '#cccccc'
  if (swatch.startsWith('#')) return { backgroundColor: swatch }
  const stops = swatch.match(/#[0-9a-f]{3,8}/gi) ?? ['#cccccc']
  return { backgroundImage: `linear-gradient(135deg, ${stops.join(', ')})` }
}

function Hanger({ size: px }: { size: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={TERRACOTTA} />
      <path d="M27 19a5 5 0 1 1 5 5v6" fill="none" stroke={CREAM} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M32 30 L12.5 43.5 Q10.5 45.5 13.5 45.5 H50.5 Q53.5 45.5 51.5 43.5 Z"
        fill="none"
        stroke={CREAM}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default async function EventPreviewImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { data } = await supabase.rpc('get_event_by_code', { p_code: code }).maybeSingle()
  const event = data as EventPreview | null

  const name = event?.name?.trim() || "You're invited"
  const when = event ? [formatEventDate(event.event_date), event.location].filter(Boolean).join(' · ') : ''
  const colors = event ? [...event.required_colors, ...event.suggested_colors].slice(0, 8) : []
  const photo = await loadPhoto(event?.inspo_image_urls[0])

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: CREAM, color: STONE }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '64px 72px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Hanger size={52} />
            <div style={{ fontSize: 24, letterSpacing: 5, color: TERRACOTTA, textTransform: 'uppercase' }}>
              {event?.host_display_name ? `${event.host_display_name} invites you` : "You're invited"}
            </div>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: name.length > 28 ? 64 : 80,
              fontWeight: 700,
              lineHeight: 1.05,
              display: 'flex',
            }}
          >
            {name}
          </div>
          {when && <div style={{ marginTop: 18, fontSize: 32, color: MUTED, display: 'flex' }}>{when}</div>}
          {event?.dress_code_text && (
            <div
              style={{
                marginTop: 32,
                display: 'flex',
                flexDirection: 'column',
                alignSelf: 'flex-start',
                background: '#f6dede',
                borderRadius: 18,
                padding: '14px 24px',
              }}
            >
              <div style={{ fontSize: 18, letterSpacing: 4, color: '#a3505d', textTransform: 'uppercase' }}>
                Dress code
              </div>
              <div style={{ fontSize: 36, marginTop: 4 }}>{event.dress_code_text}</div>
            </div>
          )}
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              {colors.map((c) => (
                <div
                  key={c}
                  style={{ width: 40, height: 40, borderRadius: 20, border: '2px solid #e4d8c9', ...swatchStyle(c) }}
                />
              ))}
            </div>
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={420} height={630} style={{ width: 420, height: 630, objectFit: 'cover' }} />
        )}
      </div>
    ),
    size
  )
}
