import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PALETTE, resolveColor } from '@/lib/shared'
import { colors, fonts } from '@/theme'

// The web palette uses CSS gradients for Silver, Gold and Multi, which
// React Native can't draw from a string; use the gradient's first color.
export function swatchFill(value: string): string {
  const swatch = resolveColor(value)?.swatch ?? '#cccccc'
  return swatch.startsWith('#') ? swatch : (swatch.match(/#[0-9a-f]{3,8}/i)?.[0] ?? '#cccccc')
}

export function SwatchDot({ value, size = 14 }: { value: string; size?: number }) {
  return (
    <View
      accessibilityLabel={resolveColor(value)?.label ?? value}
      style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: swatchFill(value) }]}
    />
  )
}

// A labeled chip, like the web's ColorChip.
export function ColorChip({ value, tone }: { value: string; tone?: 'warn' }) {
  return (
    <View style={[styles.chip, tone === 'warn' && styles.chipWarn]}>
      <SwatchDot value={value} size={12} />
      <Text style={styles.chipText}>{resolveColor(value)?.label ?? value}</Text>
    </View>
  )
}

// Tap up to `max` colors. Disabled swatches dim once the limit is reached.
export function SwatchPicker({
  value,
  onChange,
  max,
}: {
  value: string[]
  onChange: (update: (prev: string[]) => string[]) => void
  max: number
}) {
  const full = value.length >= max
  return (
    <View style={styles.grid}>
      {PALETTE.map((c) => {
        const selected = value.includes(c.id)
        const disabled = !selected && full
        return (
          <Pressable
            key={c.id}
            onPress={() =>
              onChange((prev) =>
                prev.includes(c.id) ? prev.filter((v) => v !== c.id) : [...prev, c.id].slice(0, max)
              )
            }
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityLabel={c.label}
            accessibilityState={{ checked: selected, disabled }}
            hitSlop={4}
            style={[styles.swatchHit, disabled && { opacity: 0.3 }]}
          >
            <View style={[styles.swatchRing, selected && styles.swatchRingOn]}>
              <View style={[styles.swatch, { backgroundColor: swatchFill(c.id) }]} />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  dot: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(43,36,32,0.2)' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderColor: colors.stoneLine,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipWarn: { borderColor: colors.terracottaDark, backgroundColor: colors.terracottaLight },
  chipText: { fontFamily: fonts.sans, fontSize: 13, color: colors.stone },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchHit: { padding: 2 },
  swatchRing: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  swatchRingOn: { borderColor: colors.terracotta },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(43,36,32,0.2)',
  },
})
