// The shared color palette for host color rules and guest outfit tags.
// Ids are what get stored in the database (events.*_colors and
// outfit_posts.colors), so never rename an id — add new ones instead.
// The future mobile app should mirror this list exactly.
export type PaletteColor = {
  id: string
  label: string
  // CSS background for the swatch.
  swatch: string
}

export const PALETTE: PaletteColor[] = [
  { id: 'black', label: 'Black', swatch: '#1a1a1a' },
  { id: 'white', label: 'White', swatch: '#ffffff' },
  { id: 'ivory', label: 'Ivory', swatch: '#f4efe1' },
  { id: 'beige', label: 'Beige', swatch: '#d9c4a3' },
  { id: 'brown', label: 'Brown', swatch: '#7a5230' },
  { id: 'gray', label: 'Gray', swatch: '#8c8c8c' },
  { id: 'silver', label: 'Silver', swatch: 'linear-gradient(135deg, #e6e6ec, #a9a9b3)' },
  { id: 'gold', label: 'Gold', swatch: 'linear-gradient(135deg, #e8c766, #b38a2b)' },
  { id: 'yellow', label: 'Yellow', swatch: '#f2d04b' },
  { id: 'orange', label: 'Orange', swatch: '#e8833a' },
  { id: 'red', label: 'Red', swatch: '#c8312e' },
  { id: 'burgundy', label: 'Burgundy', swatch: '#7a1f2b' },
  { id: 'pink', label: 'Pink', swatch: '#e88aa9' },
  { id: 'blush', label: 'Blush', swatch: '#f2c4c4' },
  { id: 'purple', label: 'Purple', swatch: '#7b4fa0' },
  { id: 'lavender', label: 'Lavender', swatch: '#bfa8dd' },
  { id: 'navy', label: 'Navy', swatch: '#1f2a4d' },
  { id: 'blue', label: 'Blue', swatch: '#3a6fc4' },
  { id: 'light-blue', label: 'Light Blue', swatch: '#a9cdef' },
  { id: 'teal', label: 'Teal', swatch: '#2a8c8c' },
  { id: 'emerald', label: 'Emerald', swatch: '#1f7a55' },
  { id: 'green', label: 'Green', swatch: '#3f8f4f' },
  { id: 'sage', label: 'Sage', swatch: '#a3b49a' },
  { id: 'olive', label: 'Olive', swatch: '#6b6b2e' },
  {
    id: 'multicolor',
    label: 'Print / Multi',
    swatch: 'conic-gradient(#c8312e, #f2d04b, #3f8f4f, #3a6fc4, #7b4fa0, #c8312e)',
  },
]

export const MAX_OUTFIT_COLORS = 3

const byKey = new Map<string, PaletteColor>()
for (const c of PALETTE) {
  byKey.set(c.id, c)
  byKey.set(c.label.toLowerCase(), c)
}

// Host colors used to be typed free text. Values that match a palette id
// or label (e.g. "Purple") resolve to that color; anything else
// ("dusty rose (bridesmaid color)") stays as plain text.
export function resolveColor(value: string): PaletteColor | undefined {
  return byKey.get(value.trim().toLowerCase())
}

export function toPaletteId(value: string): string {
  return resolveColor(value)?.id ?? value
}

export function isPaletteColor(value: string): boolean {
  return resolveColor(value) !== undefined
}
