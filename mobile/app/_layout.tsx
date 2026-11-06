import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React from 'react';
import { View } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/lib/auth';
import { NetworkBanner } from '../src/components/network-banner';
import { colors } from '../src/theme';

/**
 * ROOT.
 *
 * A native stack over native screens. Every route declared here is a real
 * React Native component under `app/` — there is no WebView, no iframe and no
 * embedded browser surface in this project. The Android app talks to Vidnov
 * over the same HTTPS API the website uses.
 */

const vidnovTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

const headerOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={vidnovTheme}>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Offline state is global: it renders above every screen and
                disappears by itself when connectivity returns. */}
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
              <NetworkBanner />
            </SafeAreaView>

            <Stack screenOptions={headerOptions}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
              <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
              <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
              <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
              <Stack.Screen name="shop/[sellerId]" options={{ title: 'Shop' }} />
              <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
              <Stack.Screen name="orders" options={{ title: 'My orders' }} />
              <Stack.Screen name="offers" options={{ title: 'Requests & offers' }} />
              <Stack.Screen name="saved" options={{ title: 'Saved items' }} />
              <Stack.Screen name="live" options={{ title: 'Live now' }} />
              <Stack.Screen name="ai-studio" options={{ title: 'AI Studio' }} />
              <Stack.Screen name="seller/index" options={{ title: 'Seller dashboard' }} />
              <Stack.Screen name="seller/orders" options={{ title: 'Seller orders' }} />
              <Stack.Screen name="seller/products" options={{ title: 'Your listings' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
          </View>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
