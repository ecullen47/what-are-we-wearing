// The web app's palette (app/globals.css), as values React Native can use.
export const colors = {
  cream: '#faf3ec',
  creamDark: '#f1e6d8',
  stone: '#2b2420',
  stoneMuted: '#7a6f63',
  stoneLine: '#e4d8c9',
  terracotta: '#bc5b3a',
  terracottaDark: '#9e4b2e',
  terracottaLight: '#f1ded3',
  white: '#ffffff',
  blush: '#f6dede',
  blushDeep: '#a3505d',
  sage: '#dfe8d9',
  sageDeep: '#56704f',
  butter: '#f7ecc8',
  butterDeep: '#85661a',
  sky: '#dce7f2',
  skyDeep: '#3e5d82',
  lilac: '#e9e0f2',
  lilacDeep: '#6a4f8b',
} as const

// Loaded in the root layout with useFonts.
export const fonts = {
  display: 'PlayfairDisplay_600SemiBold',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansBold: 'Geist_600SemiBold',
} as const

// Soft tints per event type, matching lib/eventTypes on the web.
const EVENT_TINTS: Record<string, { bg: string; fg: string }> = {
  wedding: { bg: colors.blush, fg: colors.blushDeep },
  dinner: { bg: colors.butter, fg: colors.butterDeep },
  party: { bg: colors.lilac, fg: colors.lilacDeep },
}

export function eventTypeTint(type: string | null | undefined) {
  return (type && EVENT_TINTS[type]) || { bg: colors.sky, fg: colors.skyDeep }
}
