import { ImageResponse } from 'next/og'

// The link preview shown when someone texts or posts a link to the site.
// Event pages reuse it (with their own title/description), since it's
// inherited by every route below app/.
export const alt = 'What Are We Wearing? Coordinate outfits with your event guests.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SWATCHES = ['#1f7a55', '#c9a23f', '#f2c4c4', '#1f2a4d', '#a3b49a']

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 96px',
          background: '#faf3ec',
          color: '#2b2420',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#bc5b3a" />
            <path
              d="M27 19a5 5 0 1 1 5 5v6"
              fill="none"
              stroke="#faf3ec"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M32 30 L12.5 43.5 Q10.5 45.5 13.5 45.5 H50.5 Q53.5 45.5 51.5 43.5 Z"
              fill="none"
              stroke="#faf3ec"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ fontSize: 28, letterSpacing: 6, color: '#bc5b3a', textTransform: 'uppercase' }}>
            Outfit coordination
          </div>
        </div>
        <div style={{ marginTop: 36, fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>What Are We Wearing?</div>
        <div style={{ marginTop: 24, fontSize: 36, color: '#7a6f63', maxWidth: 900, lineHeight: 1.35 }}>
          Set the dress code, share one link, and see what everyone&apos;s wearing.
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 48 }}>
          {SWATCHES.map((c) => (
            <div
              key={c}
              style={{ width: 44, height: 44, borderRadius: 22, background: c, border: '2px solid #e4d8c9' }}
            />
          ))}
        </div>
      </div>
    ),
    size
  )
}
