'use client';

import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/**
 * Opens (or reuses) the 1:1 chat between two users.
 *
 * Extracted from the website request detail page so the seller's app can do
 * the same thing without either copy drifting from the other. The rules require
 * `participantIds array-contains uid`, so the lookup is always scoped to the
 * signed-in user — a bare `list()` on `chats` is rejected.
 *
 * Idempotent: calling it twice returns the same chat rather than creating a
 * duplicate conversation.
 */
export async function ensureChatWith(
  firestore: Firestore,
  uidA: string,
  uidB: string,
  seedMessage = 'Conversation started from a request offer.',
): Promise<void> {
  if (!firestore || !uidA || !uidB || uidA === uidB) return;

  const chatsRef = collection(firestore, 'chats');
  const snap = await getDocs(query(chatsRef, where('participantIds', 'array-contains', uidA)));
  let existing: string | null = null;
  snap.forEach((d) => {
    const ids: string[] = d.data().participantIds ?? [];
    if (ids.includes(uidB)) existing = d.id;
  });

  if (!existing) {
    const ref = doc(chatsRef);
    await setDoc(ref, {
      id: ref.id,
      participantIds: [uidA, uidB],
      lastMessage: seedMessage,
      lastMessageTimestamp: serverTimestamp(),
    });
  }
}