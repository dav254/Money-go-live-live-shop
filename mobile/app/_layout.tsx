import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/lib/auth';
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

/**
 * FIRST SCREEN GATE.
 *
 * Vidnov opens on the welcome screen: brand, Sign in, Create account, Explore.
 * Once per launch, and only from the public root, a signed-out visitor is taken
 * there — deep links (a shared listing, a shop) are left alone, and everything
 * after that is the person's own choice. The ref is what makes "Explore" work:
 * the gate runs once, not on every navigation.
 */
function LaunchGate() {
  const { status, mode, canSell } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const routed = useRef(false);

  useEffect(() => {
    if (status === 'loading' || routed.current) return;
    const first = (segments as string[])[0];
    const atRoot = !first || first === '(tabs)';

    if (status === 'signedOut' && atRoot) {
      routed.current = true;
      router.replace('/welcome');
      return;
    }

    /**
     * A restored seller session belongs in the seller workspace. Waiting for
     * `mode` (restored from secure storage, or derived from the profile role)
     * is what keeps a seller out of the buyer home — otherwise the buyer
     * screens render while the drawer, footer and rows are already the
     * seller's. Buyer mode is untouched: a seller who switched to buying stays
     * where they are.
     */
    if (status === 'signedIn' && mode === 'seller' && canSell && atRoot) {
      routed.current = true;
      router.replace('/seller');
    }
  }, [router, segments, status, mode, canSell]);

  return null;
}

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

            <LaunchGate />

            <Stack screenOptions={headerOptions}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
              <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
              <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
              <Stack.Screen name="onboarding/role" options={{ title: 'How you use Vidnov' }} />
              <Stack.Screen name="onboarding/business" options={{ title: 'Set up your shop' }} />
              <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
              <Stack.Screen
                name="request/new"
                options={{ title: 'Post a request', presentation: 'modal' }}
              />
              <Stack.Screen name="request/[id]" options={{ title: 'Request' }} />
              <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
              <Stack.Screen name="shop/[sellerId]" options={{ title: 'Shop' }} />
              <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
              <Stack.Screen name="orders" options={{ title: 'My orders' }} />
              <Stack.Screen name="offers" options={{ title: 'Requests & offers' }} />
              <Stack.Screen name="saved" options={{ title: 'Saved items' }} />
              <Stack.Screen name="sellers" options={{ title: 'My sellers' }} />
              <Stack.Screen name="recent" options={{ title: 'Recently viewed' }} />
              <Stack.Screen name="cart" options={{ title: 'Cart' }} />
              <Stack.Screen name="rewards" options={{ title: 'Invite & earn' }} />
              <Stack.Screen name="live" options={{ title: 'Live now' }} />
              <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="videos" options={{ title: 'Videos' }} />
              <Stack.Screen name="nearby" options={{ title: 'Businesses around you' }} />
              <Stack.Screen name="wallet" options={{ title: 'My wallet' }} />
              <Stack.Screen name="addresses" options={{ title: 'My addresses' }} />
              <Stack.Screen name="help" options={{ title: 'Help & support' }} />
              <Stack.Screen name="ai-studio" options={{ title: 'AI Studio' }} />
              {/* The seller centre owns its own stack and headers. */}
              <Stack.Screen name="seller" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
          </View>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
