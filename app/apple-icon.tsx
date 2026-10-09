import { ImageResponse } from 'next/og'

// iOS home-screen / iMessage icon: the same hanger mark as icon.svg.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#bc5b3a',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 64 64">
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
      </div>
    ),
    size
  )
}
