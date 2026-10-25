import { useCallback, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Body, Button, Card, Heading, Label, styles as ui } from '@/components/ui'
import { forgetEvent, getRecentEvents, type RecentEvent } from '@/lib/guestIdentity'
import { confirm } from '@/lib/confirm'
import { getEvent, normalizeCode } from '@/lib/api'
import { countdownLabel, eventTypeLabel, formatEventDate } from '@/lib/shared'
import { colors, eventTypeTint, fonts } from '@/theme'

// Home: type an invite code, or reopen an event from this phone.
export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [opening, setOpening] = useState(false)
  const [recent, setRecent] = useState<RecentEvent[]>([])

  // Refresh the list whenever we come back here from an event.
  useFocusEffect(
    useCallback(() => {
      setRecent(getRecentEvents())
    }, [])
  )

  // Only takes it off this phone's list; the event itself is untouched.
  const remove = async (e: RecentEvent) => {
    if (!(await confirm(`Remove ${e.name}?`, 'It comes off this list. You can open it again with its code.', 'Remove'))) return
    forgetEvent(e.code)
    setRecent(getRecentEvents())
  }

  const open = async () => {
    const normalized = normalizeCode(code)
    if (!normalized) {
      setMessage('Enter the invite code from your host.')
      return
    }
    setOpening(true)
    setMessage('')
    try {
      const event = await getEvent(normalized)
      if (!event) {
        setMessage("We couldn't find that code. Double-check it with your host.")
        return
      }
      setCode('')
      router.push({ pathname: '/event/[code]', params: { code: normalized } })
    } catch {
      setMessage("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setOpening(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Heading style={styles.brand}>
            What Are We <Heading style={[styles.brand, { color: colors.terracotta }]}>Wearing?</Heading>
          </Heading>
          <Body muted style={styles.tagline}>
            So nobody shows up in the same dress.
          </Body>

          <Card style={styles.joinCard}>
            <Label>Have an invite code?</Label>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase())
                setMessage('')
              }}
              placeholder="e.g. K7M2QX"
              placeholderTextColor={colors.stoneMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={open}
              accessibilityLabel="Invite code"
              style={[ui.input, styles.codeInput]}
            />
            <Button title="Open event" onPress={open} busy={opening} />
            {message ? <Body style={styles.message}>{message}</Body> : null}
          </Card>

          {recent.length > 0 && (
            <View style={styles.recent}>
              <View style={styles.recentHeading}>
                <Label>Your events</Label>
                <Body muted style={styles.recentHint}>Press and hold to remove</Body>
              </View>
              {recent.map((e) => {
                const tint = eventTypeTint(e.eventType)
                const countdown = countdownLabel(e.eventDate)
                return (
                  <Pressable
                    key={e.code}
                    onPress={() => router.push({ pathname: '/event/[code]', params: { code: e.code } })}
                    onLongPress={() => remove(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${e.name}`}
                    accessibilityActions={[{ name: 'remove', label: 'Remove from your events' }]}
                    onAccessibilityAction={(a) => a.nativeEvent.actionName === 'remove' && remove(e)}
                    style={({ pressed }) => [styles.recentRow, pressed && { backgroundColor: colors.creamDark }]}
                  >
                    <View style={[styles.recentTint, { backgroundColor: tint.bg }]}>
                      <Body style={[styles.recentType, { color: tint.fg }]}>{eventTypeLabel(e.eventType)}</Body>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={styles.recentName} numberOfLines={1}>
                        {e.name}
                      </Body>
                      <Body muted style={styles.recentMeta}>
                        {[formatEventDate(e.eventDate), countdown].filter(Boolean).join(' · ')}
                      </Body>
                    </View>
                    <Body style={styles.chevron}>›</Body>
                  </Pressable>
                )
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: 24, paddingTop: 48 },
  brand: { fontSize: 34, lineHeight: 40 },
  tagline: { marginTop: 8, fontSize: 16 },
  joinCard: { marginTop: 32, gap: 12 },
  codeInput: { fontFamily: fonts.sansBold, fontSize: 20, letterSpacing: 4, textAlign: 'center' },
  message: { color: colors.terracottaDark, fontSize: 14 },
  recent: { marginTop: 32 },
  recentHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  recentHint: { fontSize: 12 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  recentTint: { width: 64, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recentType: { fontFamily: fonts.sansMedium, fontSize: 11 },
  recentName: { fontFamily: fonts.sansBold, fontSize: 16 },
  recentMeta: { fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.stoneMuted },
})
