import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fonts } from '@/theme'

// Full-screen photo; tap anywhere or the close button to dismiss.
export default function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close photo">
        <SafeAreaView style={styles.safe}>
          <View style={styles.closeRow}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          {url && <Image source={url} style={styles.image} contentFit="contain" />}
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(43,36,32,0.94)' },
  safe: { flex: 1 },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: 16 },
  close: { fontFamily: fonts.sans, fontSize: 36, color: colors.cream },
  image: { flex: 1, margin: 12 },
})
