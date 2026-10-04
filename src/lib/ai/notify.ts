/**
 * AI notifications (spec §15).
 *
 * Reuses the EXISTING Vidnov notification system (`notifications`
 * collection, same shape the notification centre reads) — no separate AI
 * notification pipeline. Written server-side with the admin SDK so it works
 * regardless of client rules.
 */
import { db } from '@/firebase/server';
import { pushExistingNotification } from '@/lib/notifications/push-server';

export type AiNotificationKind = 'started' | 'completed' | 'failed';

const MESSAGES: Record<AiNotificationKind, { title: string; message: string }> = {
  started: {
    title: 'Your creation is being processed',
    message: 'Your AI generation is in the queue. We will notify you the moment it is ready.',
  },
  completed: {
    title: 'Your AI creation is ready',
    message: 'Your generation finished successfully. Open AI Studio to view, save or use it.',
  },
  failed: {
    title: 'Your generation could not be completed',
    message: 'The AI engine could not finish this job. Any points charged were refunded.',
  },
};

const LINKS: Record<AiNotificationKind, string> = {
  started: '/dashboard/seller/ai-studio?tab=queue',
  completed: '/dashboard/seller/ai-studio?tab=creations',
  failed: '/dashboard/seller/ai-studio?tab=history',
};

/** Writes one AI lifecycle notification. Never throws — AI is best-effort here. */
export async function notifyAiEvent(params: {
  userId: string;
  kind: AiNotificationKind;
  type?: string;
}): Promise<void> {
  try {
    const copy = MESSAGES[params.kind];
    await db.collection('notifications').add({
      userId: params.userId,
      type: params.type ?? 'message',
      title: copy.title,
      message: copy.message,
      link: LINKS[params.kind],
      status: 'unread',
      timestamp: new Date(),
    });

    // This writer predates the notification engine and uses its own field
    // names, so it cannot go through `notify()` without changing the document
    // shape every reader depends on. Push is pushed separately instead — see
    // `pushExistingNotification`.
    void pushExistingNotification(db, params.userId, {
      title: copy.title,
      body: copy.message,
      link: LINKS[params.kind],
      category: 'ai',
    });
  } catch (error) {
    console.error('[ai/notify]', error);
  }
}