/**
 * VIDNOV Communication Engine — one entry point for in-app, email and push
 * delivery. Every feature sends notifications through `notify()`; nothing
 * writes to `notifications` or calls the email or push services directly from
 * feature code.
 *
 * Notification doc shape (collection: notifications):
 *   userId, type, title, message, entityType, entityId, link,
 *   isRead, readAt, createdAt
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { appLink, type EmailCategory } from './config';
import { sendTemplateEmail } from './email-service';
import { sendPushToUser } from './push-server';
import { isPushEnabledFor } from './push-preferences';
import { createNotification } from './store';

export type NotificationType =
  | 'ORDER_CONFIRMED' | 'ORDER_STATUS' | 'BOOKING_CONFIRMED' | 'BOOKING_REMINDER'
  | 'PAYMENT_CONFIRMED' | 'REFUND' | 'MESSAGE' | 'NEW_ORDER' | 'NEW_BOOKING'
  | 'NEW_MESSAGE' | 'PAYMENT_RECEIVED' | 'LISTING_APPROVED' | 'LISTING_REJECTED'
  | 'NEW_REVIEW' | 'GENERATION_STARTED' | 'GENERATION_COMPLETE' | 'GENERATION_FAILED'
  | 'AI_POINTS_UPDATE' | 'MEDIA_UPLOADED' | 'BACKUP_COMPLETE' | 'SYNC_FAILED'
  | 'STORAGE_WARNING' | 'SECURITY_ALERT' | 'NEW_LOGIN' | 'PASSWORD_CHANGED'
  | 'SYSTEM' | 'WELCOME' | 'BUSINESS_APPROVED';

/** Categories used by the notification center tabs. */
export type NotificationCategory =
  | 'orders' | 'bookings' | 'messages' | 'payments'
  | 'ai' | 'business' | 'security' | 'system';

export const CATEGORY_BY_TYPE: Record<NotificationType, NotificationCategory> = {
  ORDER_CONFIRMED: 'orders', ORDER_STATUS: 'orders', NEW_ORDER: 'orders',
  BOOKING_CONFIRMED: 'bookings', BOOKING_REMINDER: 'bookings', NEW_BOOKING: 'bookings',
  MESSAGE: 'messages', NEW_MESSAGE: 'messages',
  PAYMENT_CONFIRMED: 'payments', REFUND: 'payments', PAYMENT_RECEIVED: 'payments',
  GENERATION_STARTED: 'ai', GENERATION_COMPLETE: 'ai', GENERATION_FAILED: 'ai', AI_POINTS_UPDATE: 'ai',
  LISTING_APPROVED: 'business', LISTING_REJECTED: 'business', NEW_REVIEW: 'business', BUSINESS_APPROVED: 'business',
  NEW_LOGIN: 'security', PASSWORD_CHANGED: 'security', SECURITY_ALERT: 'security',
  MEDIA_UPLOADED: 'system', BACKUP_COMPLETE: 'system', SYNC_FAILED: 'system',
  STORAGE_WARNING: 'system', SYSTEM: 'system', WELCOME: 'system',
};

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Firestore entity for deep-linking, e.g. ORDER, PRODUCT, BOOKING. */
  entityType?: string;
  entityId?: string;
  /** App path — built absolute for email links automatically. */
  link?: string;
  /** Send email alongside the in-app notification (respects prefs upstream). */
  email?: {
    to: string;
    templateKey: string;
    vars?: Record<string, string | undefined>;
    category: EmailCategory;
    userName?: string;
  };
  /**
   * Firestore contract — pass admin firestore in server code.
   *
   * Deliberately the Admin SDK's own `Firestore` type rather than a hand-rolled
   * duck-type. The engine now also reads push preferences and sends to device
   * subscriptions, so it needs `doc()`, `batch()` and typed collections. A
   * narrow local shape here would have pushed casts into every caller and
   * still not described what the function actually does.
   */
  db: AdminFirestore;
}

/**
 * Creates an in-app notification, fans out an email, and sends a Web Push to
 * the user's subscribed devices.
 *
 * ## All three channels are independent
 *
 * The in-app document is written first and is the only one whose failure is
 * worth reporting. Email and push are best-effort: each is wrapped so a dead
 * push token or an email provider outage cannot fail the order, payment or chat
 * message that triggered the notification in the first place.
 *
 * ## Push respects per-category preferences
 *
 * A user can silence live-stream alerts while still wanting order updates, so
 * the category is checked before sending rather than sending everything and
 * hoping. Security alerts bypass the preference — see `push-preferences`.
 *
 * Returns the notification id.
 */
export async function notify(input: NotifyInput): Promise<string | undefined> {
  const { db, email, ...notification } = input;

  let notificationId: string | undefined;
  try {
    /*
     * VPS-controlled storage: `createNotification` writes PocketBase when it
     * is configured and only falls back to Firestore when it is not (see
     * `store.ts`). It also suppresses duplicates — a webhook retry firing the
     * same event twice lands once in the inbox.
     */
    const result = await createNotification({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      category: CATEGORY_BY_TYPE[notification.type] ?? 'system',
      entityType: notification.entityType,
      entityId: notification.entityId,
      link: notification.link,
    });
    if (result.duplicate) return undefined;
    notificationId = result.id ?? undefined;
    if (!notificationId) {
      console.error('[notify] failed to write notification');
    }
  } catch (error) {
    console.error('[notify] failed to write notification:', error);
  }

  if (email) {
    await sendTemplateEmail({
      templateKey: email.templateKey,
      category: email.category,
      to: email.to,
      userId: input.userId,
      vars: {
        user_name: email.userName,
        ...input.link ? { app_url: appLink(input.link) } : {},
        ...email.vars,
      },
    });
  }

  // Push last, and never let it affect the result. The in-app notification is
  // already written by this point, so a push failure cannot lose the event.
  try {
    const category = CATEGORY_BY_TYPE[notification.type] ?? 'system';
    if (await isPushEnabledFor(input.userId, category)) {
      await sendPushToUser(input.userId, {
        title: notification.title,
        body: notification.message,
        link: notification.link,
        category,
      });
    }
  } catch (error) {
    console.error('[notify] push failed (non-fatal):', error);
  }

  return notificationId;
}
