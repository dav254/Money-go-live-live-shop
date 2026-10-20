'use client';

/**
 * ADMIN · NOTIFICATIONS.
 *
 * The admin header has always linked here, but the route never existed — the
 * bell 404'd on every click. It renders the shared notification centre inside
 * the admin chrome, so the admin sidebar and header stay visible like on every
 * other admin screen.
 *
 * The inbox queries only `userId == <this admin>`; admins are not special here
 * (reading everyone's notifications would need an admin-claim query the rules
 * deliberately do not grant on this collection).
 */

import { AdminLayout } from '@/components/layout/admin-layout';
import NotificationCenterPage from '@/app/dashboard/notifications/page';

export default function AdminNotificationsPage() {
  return (
    <AdminLayout>
      <NotificationCenterPage />
    </AdminLayout>
  );
}
