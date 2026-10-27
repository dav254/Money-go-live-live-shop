'use client';

import type { Firestore } from 'firebase/firestore';
import { getSurfaceAuth } from '@/firebase/surface-auth';
import { openChat } from '@/lib/chat/client';

/**
 * Opens (or reuses) the 1:1 chat between two users.
 *
 * Extracted from the website request detail page so the seller's app can do
 * the same thing without either copy drifting from the other.
 *
 * Idempotent: calling it twice returns the same chat rather than creating a
 * duplicate conversation (the store sorts the pair, so A→B and B→A collide on
 * the same row).
 *
 * ## Migration note — VPS store, no Firestore write
 *
 * The first parameter is still accepted so every existing call site keeps
 * compiling, but it is no longer used: conversations are created by
 * `POST /api/chat`, which verifies the caller's ID token and writes to
 * PocketBase on the VPS. Passing `firestore` here no longer means the chat
 * lands in Firebase.
 */
export async function ensureChatWith(
  _firestore: Firestore | null,
  uidA: string,
  uidB: string,
  seedMessage = 'Conversation started from a request offer.',
): Promise<void> {
  if (!uidA || !uidB || uidA === uidB) return;

  const current = getSurfaceAuth().currentUser;
  if (!current) throw new Error('Sign in to open a conversation.');
  if (current.uid !== uidA) throw new Error('Sign in as this user to open a conversation.');

  await openChat(current, uidB, seedMessage);
}
