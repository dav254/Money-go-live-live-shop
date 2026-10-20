'use client';

/**
 * WEBSITE · BUYER NOTIFICATIONS.
 *
 * This route used to render a "Feature Removed" placeholder — the inbox had
 * been declared dead while the header had no way to reach any inbox at all,
 * which left website buyers with notifications they could never read (the app
 * copy lives at `/app/buyer/notifications`, reachable only from inside the PWA
 * section).
 *
 * Rather than duplicate 300 lines of list/filter/mark-read logic, this page is
 * the shared notification centre (`/dashboard/notifications`) rendered inside
 * the buyer chrome. The inbox itself queries only the signed-in user's own
 * documents — the same equality-filtered query the Firestore rules allow.
 */

import { BuyerLayout } from '@/components/layout/buyer-layout';
import NotificationCenterPage from '@/app/dashboard/notifications/page';

export default function BuyerNotificationsPage() {
  return (
    <BuyerLayout>
      <NotificationCenterPage />
    </BuyerLayout>
  );
}
