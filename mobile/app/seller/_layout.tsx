import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '../../src/theme';

/**
 * SELLER CENTRE STACK.
 *
 * One stack for the whole business workspace: every screen shares the same
 * background, the same Android back handling and the same transition. Each
 * screen renders its own `SellerHeader`, so the shop's identity — not a generic
 * app bar — is what the seller sees at the top of their tools.
 *
 * The screen list is exhaustive on purpose. A route added under `app/seller`
 * without being listed here still works, but listing it documents the surface
 * and keeps the titles honest.
 */
export default function SellerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="menu" />
      <Stack.Screen name="shop" />
      <Stack.Screen name="discovery" />
      <Stack.Screen name="growth" />
      <Stack.Screen name="share" />
      <Stack.Screen name="create" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="points" />
      <Stack.Screen name="rewards" />
      <Stack.Screen name="account" />
      <Stack.Screen name="business" />
      <Stack.Screen name="products/index" />
      <Stack.Screen name="products/new" />
      <Stack.Screen name="products/[id]" />
      <Stack.Screen name="content" />
      <Stack.Screen name="live" />
      <Stack.Screen name="live/broadcast" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="inquiries" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="customers" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="marketing" />
      <Stack.Screen name="reseller" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="help" />
    </Stack>
  );
}
