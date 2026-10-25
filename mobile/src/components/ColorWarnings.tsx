import { StyleSheet, View } from 'react-native'
import { Body } from '@/components/ui'
import { ColorChip } from '@/components/Swatch'
import { resolveColor, toPaletteId } from '@/lib/shared'
import { colors } from '@/theme'

const label = (c: string) => resolveColor(c)?.label ?? c

// Off-limit colors in a selection, as palette ids.
export function offLimitMatches(picked: string[], offLimit: string[]): string[] {
  const banned = new Set(offLimit.map(toPaletteId))
  return picked.filter((c) => banned.has(c))
}

// The web's ColorWarnings: off-limit clashes first, then colors others
// are already wearing, then any required colors not picked yet.
export default function ColorWarnings({
  picked,
  required,
  offLimit,
  takenCounts,
}: {
  picked: string[]
  required: string[]
  offLimit: string[]
  takenCounts: Map<string, number>
}) {
  const clashes = offLimitMatches(picked, offLimit)
  const alreadyWorn = picked.filter((c) => !clashes.includes(c) && (takenCounts.get(c) ?? 0) > 0)
  const missingRequired = required.map(toPaletteId).filter((c) => !picked.includes(c))

  return (
    <>
      {clashes.length > 0 && (
        <View style={[styles.warning, styles.warningStrong]}>
          <Body style={styles.warningText}>The host asked guests to avoid:</Body>
          <View style={styles.chips}>
            {clashes.map((c) => (
              <ColorChip key={c} value={c} tone="warn" />
            ))}
          </View>
        </View>
      )}
      {alreadyWorn.length > 0 && (
        <View style={styles.warning}>
          <Body style={styles.warningText}>
            Heads up:{' '}
            {alreadyWorn
              .map((c) => {
                const n = takenCounts.get(c) ?? 0
                return `${n} ${n === 1 ? 'person is' : 'people are'} already wearing ${label(c)}`
              })
              .join('; ')}
            .
          </Body>
        </View>
      )}
      {picked.length > 0 && missingRequired.length > 0 && (
        <Body muted style={styles.hint}>
          The host asked everyone to wear {missingRequired.map(label).join(', ')}.
        </Body>
      )}
    </>
  )
}

// How many posts use each color, optionally leaving one post out (the one
// being edited, so it doesn't warn about itself).
export function countColors(posts: { id: string; colors: string[] | null }[], exceptId?: string) {
  const counts = new Map<string, number>()
  for (const p of posts) {
    if (p.id === exceptId) continue
    for (const c of p.colors ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return counts
}

const styles = StyleSheet.create({
  hint: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  warning: { backgroundColor: colors.butter, borderRadius: 10, padding: 12, gap: 8 },
  warningStrong: { backgroundColor: colors.terracottaLight },
  warningText: { fontSize: 14 },
})
