'use client';

import { PushSettingsScreen } from '@/components/app/notifications/push-settings-screen';

/**
 * BUYER APP · NOTIFICATION SETTINGS (`/app/buyer/settings/notifications`).
 *
 * Separate from the notifications INBOX on purpose. The inbox is a history of
 * what already happened; this is where you decide what reaches your phone in
 * the first place. They get confused when they share a screen, because turning
 * something on reads like scrolling through it.
 *
 * The seller section has its own at `/app/seller/settings/notifications`
 * rendering the same component — one screen, two shells, so the two can never
 * drift apart on what a category is called or which switches exist.
 */
export default function BuyerNotificationSettingsPage() {
  return <PushSettingsScreen />;
}
