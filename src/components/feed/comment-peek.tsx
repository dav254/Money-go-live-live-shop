'use client';

/**
 * COMMENT PEEK — the in-feed comment surface.
 *
 * ## What it replaces
 *
 * The comment bubble used to open `CommentDrawer`, a bottom sheet covering 70%
 * of the screen. Reading who had commented on a product meant leaving the
 * product: the video, the price and the SHOP button all disappeared behind a
 * sheet, and dismissing it dropped you back into the feed having lost your
 * place. For a comment thread that is mostly *reading* — "has anyone said
 * anything about this?" — that was far too much ceremony.
 *
 * ## What it does instead
 *
 * A card that slides in over the lower third of the same video, lists the
 * comments with the author's real name, and takes a reply without the feed ever
 * losing the product. It closes itself: `AUTO_HIDE_MS` after it opens, and
 * immediately on Escape or a tap outside. Dismissal is the default rather than
 * a close button you have to find, because the common case is "glance and get
 * back to shopping".
 *
 * ## Names, not "Anonymous"
 *
 * `resolveCommenterName` resolves displayName → email local part → "Buyer", so
 * a row always names a role or a person. See `lib/comments.ts`.
 */

import * as React from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MessageSquare, Send, X } from 'lucide-react';

import type { Comment } from '@/lib/types';
import { resolveCommenterName } from '@/lib/comments';
import { cn } from '@/lib/utils';

/** How long the peek stays up before it takes itself back down. */
const AUTO_HIDE_MS = 6000;

/** How many comments to show at once. The rest is counted, not hidden. */
const MAX_VISIBLE = 3;

export function commenterName(comment: Comment): string {
  return (
    resolveCommenterName({
      displayName: comment.userName,
      email: comment.userEmail,
    }) || 'Buyer'
  );
}

interface CommentPeekProps {
  comments: Comment[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddComment: (text: string) => void;
  isLoading: boolean;
  /** Counts the reply against the rail's badge while the peek is open. */
  className?: string;
}

export function CommentPeek({
  comments,
  isOpen,
  onOpenChange,
  onAddComment,
  isLoading,
  className,
}: CommentPeekProps) {
  const [draft, setDraft] = React.useState('');
  const [draftOpen, setDraftOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const visible = comments.slice(-MAX_VISIBLE);
  const hiddenCount = Math.max(0, comments.length - MAX_VISIBLE);

  /*
   * Self-dismissing.
   *
   * The timer is cleared whenever the peek closes or the comment list changes
   * identity, so a re-render mid-countdown can never leave it to fire against a
   * stale state and close something the user has just reopened.
   */
  React.useEffect(() => {
    if (!isOpen || draftOpen) return;
    const t = setTimeout(() => {
      onOpenChange(false);
      setDraftOpen(false);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [isOpen, draftOpen, comments.length, onOpenChange]);

  /* Escape closes it — a keyboard user must not be trapped by a self-closing
     panel. */
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        setDraftOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onOpenChange]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAddComment(text);
    setDraft('');
    setDraftOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Tap anywhere else on the card to dismiss. */}
          <button
            type="button"
            aria-label="Close comments"
            onClick={() => {
              onOpenChange(false);
              setDraftOpen(false);
            }}
            className="absolute inset-0 z-30 cursor-default"
          />

          <motion.div
            key="comment-peek"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'absolute inset-x-3 bottom-3 z-40 overflow-hidden rounded-2xl',
              'border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl',
              className,
            )}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </span>
              <button
                type="button"
                aria-label="Close comments"
                onClick={() => {
                  onOpenChange(false);
                  setDraftOpen(false);
                }}
                className="ml-auto rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-44 space-y-2.5 overflow-y-auto px-3 py-2.5">
              {isLoading && (
                <div className="flex items-center gap-2 py-1 text-white/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Loading comments…</span>
                </div>
              )}

              {!isLoading && comments.length === 0 && (
                <p className="py-2 text-xs text-white/60">
                  No comments yet. Be the first to ask about this product.
                </p>
              )}

              {visible.map((comment) => {
                const name = commenterName(comment);
                return (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                      {comment.userAvatar ? (
                        /*
                         * `unoptimized` because these avatars are arbitrary
                         * remote URLs — a Firebase photoURL, or the picsum
                         * seed fallback — so they cannot all be listed in
                         * next.config remotePatterns. The optimiser is skipped
                         * rather than the rule disabled.
                         */
                        <Image
                          src={comment.userAvatar}
                          alt=""
                          fill
                          sizes="28px"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-[11px] font-bold text-cyan-300">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-cyan-300">{name}</p>
                      <p className="text-xs leading-snug text-white/90">{comment.text}</p>
                    </div>
                  </div>
                );
              })}

              {hiddenCount > 0 && (
                <p className="pt-0.5 text-[10px] uppercase tracking-wide text-white/40">
                  +{hiddenCount} earlier {hiddenCount === 1 ? 'comment' : 'comments'}
                </p>
              )}
            </div>

            {draftOpen ? (
              <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
                <input
                  ref={inputRef}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  maxLength={280}
                  className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white outline-none transition placeholder:text-white/35 focus:border-cyan-400/60"
                />
                <button
                  type="submit"
                  aria-label="Post comment"
                  disabled={!draft.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftOpen(true);
                  // The auto-hide is suspended while the composer is open; see
                  // the effect above. Refocus once the field exists.
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs text-white/50 transition hover:bg-white/5 hover:text-white/80"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Add a comment…
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
