import { Alert, Platform } from 'react-native'

// Alert.alert does nothing on web, where the app is also previewed.
export function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ])
  )
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title)
  else Alert.alert(title, message)
}
