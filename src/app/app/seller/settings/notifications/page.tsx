'use client';

import { PushSettingsScreen } from '@/components/app/notifications/push-settings-screen';

/**
 * SELLER APP · NOTIFICATION SETTINGS (`/app/seller/settings/notifications`).
 *
 * The same component as the buyer's screen. A seller has more to be interrupted
 * about (new orders, payments, AI generations, listing decisions) but the
 * *mechanism* is identical, and two hand-maintained copies of a list of
 * notification switches is how one of them ends up missing a category.
 */
export default function SellerNotificationSettingsPage() {
  return <PushSettingsScreen />;
}
