import { ActivityIndicator, Pressable, StyleSheet, Text, type TextProps, View, type ViewProps } from 'react-native'
import { colors, fonts } from '@/theme'

// Small building blocks so screens read like the web app: Playfair
// headings, Geist body text, cream cards and terracotta pill buttons.

export function Heading({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.heading, style]} />
}

export function Body({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  return <Text {...props} style={[styles.body, muted && styles.muted, style]} />
}

export function Label({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.label, style]} />
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  compact,
  accessibilityLabel,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'outline' | 'quiet'
  disabled?: boolean
  busy?: boolean
  compact?: boolean
  accessibilityLabel?: string
}) {
  const inactive = disabled || busy
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'quiet' && styles.quiet,
        pressed && !inactive && (variant === 'primary' ? styles.primaryPressed : styles.outlinePressed),
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.cream : colors.terracotta} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            compact && styles.buttonTextCompact,
            { color: variant === 'primary' ? colors.cream : colors.terracotta },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export const styles = StyleSheet.create({
  heading: { fontFamily: fonts.display, color: colors.stone, fontSize: 28, lineHeight: 34 },
  body: { fontFamily: fonts.sans, color: colors.stone, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.stoneMuted },
  label: {
    fontFamily: fonts.sansMedium,
    color: colors.stoneMuted,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.stoneLine,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
  },
  button: {
    minHeight: 46,
    borderRadius: 999,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 34, paddingHorizontal: 14 },
  primary: { backgroundColor: colors.terracotta },
  primaryPressed: { backgroundColor: colors.terracottaDark },
  outline: { borderWidth: 1, borderColor: colors.terracotta, backgroundColor: 'transparent' },
  outlinePressed: { backgroundColor: colors.terracottaLight },
  quiet: { backgroundColor: 'transparent' },
  inactive: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 15 },
  buttonTextCompact: { fontSize: 13 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.stone,
    backgroundColor: colors.white,
    borderColor: colors.stoneLine,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
})
