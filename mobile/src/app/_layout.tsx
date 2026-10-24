import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display'
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from '@expo-google-fonts/geist'
import { colors, fonts } from '@/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_600SemiBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  })

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync()
  }, [loaded, error])

  if (!loaded && !error) return null

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.cream },
          headerShadowVisible: false,
          headerTintColor: colors.terracotta,
          headerTitleStyle: { fontFamily: fonts.display, color: colors.stone },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.cream },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="event/[code]/index" options={{ title: '' }} />
        <Stack.Screen
          name="event/[code]/post"
          options={{ title: 'Post your outfit', presentation: 'modal' }}
        />
      </Stack>
    </>
  )
}
