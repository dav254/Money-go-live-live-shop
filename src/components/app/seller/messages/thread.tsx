'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCheck, ChevronDown, FileText, Loader2, Mic, Package,
  Paperclip, Pause, Play, Send, Square, Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  addDoc, arrayUnion, collection, doc, increment,
  orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import {
  useCollection, useDoc, useFirestore, useMemoFirebase, useStorage, useUser,
} from '@/firebase';
import type { Chat, ChatMessage, Order, Product, UserProfile } from '@/lib/types';
import { ListingThumb } from '@/components/app/seller/listing-thumb';
import { OrderStatusPill } from '@/components/app/seller/seller-app-shell';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * SELLER APP · CONVERSATION THREAD.
 *
 * Written for this section rather than reusing the website's `ChatWindow`. The
 * feature set is deliberately the same — text, images, video, files, voice
 * notes, shared products, shared orders, delete — because a seller talking to a
 * buyer does not suddenly have fewer needs because they opened the app. What
 * changes is the chrome and two decisions that only make sense for a seller:
 *
 *  - **Shared products come from this seller's own catalogue.** The website
 *    offers the same button to buyers, where it reads "my products" while
 *    meaning the seller's. Here the seller picks from their live stock.
 *  - **A shared order shows fulfilment state, not a Pay button.** The website
 *    renders "PAY NOW" inside a chat bubble; a seller cannot pay their own
 *    invoice, and a dead call to action in the middle of a conversation is
 *    worse than no button. The card links to this section's Orders screen.
 *
 * ## Write contract
 *
 * Identical to the website's, because these are the same Firestore documents:
 *   chats/{id}/messages  { senderId, timestamp, isRead, messageType, … }
 *   chats/{id}           lastMessage, lastMessageTimestamp, deletedFor,
 *                        unreadCounts.{uid}
 *
 * Note the field name: the runtime key is `messageText`, while the `ChatMessage`
 * type declares `text`. `ChatMessage` in `@/lib/types` predates the chat
 * rewrite and was never updated, so messages written by either surface carry
 * `messageText`. Reading both here means this thread renders history written by
 * the website, and vice versa.
 */

const ONLINE_WINDOW_MS = 120_000;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function bodyOf(message: ChatMessage): string {
  const raw = message as unknown as { messageText?: string; text?: string };
  return raw.messageText ?? raw.text ?? '';
}

function timeOf(message: ChatMessage): string {
  const ts = message.timestamp;
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

export function SellerThread({
  chat,
  currentUser,
  other,
  onBack,
  onDeleted,
}: {
  chat: Chat;
  currentUser: User;
  other?: UserProfile;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const firestore = useFirestore();
  // Surface-bound storage. Bare `getStorage()` looks for the `[DEFAULT]` app,
  // which this project never creates, so it threw `app/no-app` the moment the
  // seller pressed record.
  const storage = useStorage();
  const { toast } = useToast();

  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [uploadPct, setUploadPct] = React.useState<number | null>(null);
  const [pickOpen, setPickOpen] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [recording, setRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);

  const fileRef = React.useRef<HTMLInputElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'chats', chat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chat.id]);

  const { data: messages } = useCollection<ChatMessage>(messagesQuery);

  // Open the conversation ⇒ clear its unread badge, for me only.
  React.useEffect(() => {
    if (!messages || !messages.length) return;
    const unread = messages.filter((m) => m.senderId !== currentUser.uid && !m.isRead);
    if (unread.length === 0) return;

    const batch = writeBatch(firestore!);
    unread.forEach((m) => {
      batch.set(doc(firestore!, 'chats', chat.id, 'messages', m.id), {
        isRead: true,
        readAt: serverTimestamp(),
      });
    });
    batch.set(doc(firestore!, 'chats', chat.id), { [`unreadCounts.${currentUser.uid}`]: 0 });
    batch.commit().catch(() => undefined);
  }, [messages, chat.id, currentUser.uid, firestore]);

  // Stay pinned to the newest message unless the seller has scrolled up.
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  /**
   * Write a message and roll the conversation forward.
   *
   * `deletedFor` is reset to `[]` on every send: re-opening a chat the seller
   * previously deleted is a deliberate action, and it must not stay invisible
   * because of a stale flag left by whoever last wrote in it.
   */
  const send = React.useCallback(
    async (payload: Partial<ChatMessage>) => {
      const otherId = chat.participantIds.find((id) => id !== currentUser.uid);
      await addDoc(collection(firestore!, 'chats', chat.id, 'messages'), {
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        ...payload,
      });

      const preview =
        payload.messageType === 'voice'
          ? 'Voice note'
          : payload.messageType === 'product'
            ? 'Shared a product'
            : payload.messageType === 'order'
              ? 'Shared an order'
              : payload.messageType === 'text'
                ? bodyOf(payload as ChatMessage)
                : 'Sent a file';

      const update: Record<string, unknown> = {
        lastMessage: preview.slice(0, 140),
        lastMessageTimestamp: serverTimestamp(),
        deletedFor: [],
      };
      if (otherId) update[`unreadCounts.${otherId}`] = increment(1);
      await updateDoc(doc(firestore!, 'chats', chat.id), update);
    },
    [firestore, chat.id, chat.participantIds, currentUser.uid],
  );

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await send({ messageText: text, messageType: 'text' });
      setAtBottom(true);
    } catch {
      // Put the text back rather than losing what they typed.
      setDraft(text);
      toast({ variant: 'destructive', title: 'Message not sent', description: 'Check your connection.' });
    } finally {
      setSending(false);
    }
  };

  const upload = React.useCallback(
    (file: File, messageType: 'image' | 'video' | 'file', duration?: number) => {
    const task = uploadBytesResumable(
      ref(storage, `chats/${chat.id}/${Date.now()}_${file.name}`),
      file,
    );
    setUploadPct(0);
    task.on(
      'state_changed',
      (s) => setUploadPct((s.bytesTransferred / s.totalBytes) * 100),
      () => {
        setUploadPct(null);
        toast({ variant: 'destructive', title: 'Upload failed' });
      },
      async () => {
        try {
          const mediaUrl = await getDownloadURL(task.snapshot.ref);
          await send({
            messageType,
            mediaUrl,
            // `duration` is only meaningful for a voice note; the website's
            // player reads it to render the length on the bubble.
            mediaMetadata: { name: file.name, size: file.size, type: file.type, duration },
          });
          setAtBottom(true);
        } catch {
          toast({ variant: 'destructive', title: 'Could not send the file' });
        } finally {
          setUploadPct(null);
          if (fileRef.current) fileRef.current.value = '';
        }
      },
    );
    },
    [storage, chat.id, send],
  );

  const chooseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum size is 20 MB.',
      });
      e.target.value = '';
      return;
    }
    const kind = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'file';
    upload(file, kind);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const seconds = recordingSecondsRef.current;
        if (blob.size > 200) {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
          upload(file, 'file', seconds);
        }
      };

      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Microphone blocked',
        description: 'Allow microphone access to send a voice note.',
      });
    }
  };

  const recordingSecondsRef = React.useRef(0);
  React.useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  React.useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const removeConversation = async () => {
    try {
      await updateDoc(doc(firestore!, 'chats', chat.id), {
        deletedFor: arrayUnion(currentUser.uid),
      });
      onDeleted();
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete this chat' });
    }
  };

  const online = !!other?.lastSeen && Date.now() - other.lastSeen.toMillis() < ONLINE_WINDOW_MS;
  const ordered = messages ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border/70 bg-card/40 px-3 py-2.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <span className="relative shrink-0">
          {other?.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={other.profilePictureUrl}
              alt=""
              className="h-9 w-9 rounded-full border border-border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
              {(other?.fullName || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
              online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {other?.fullName || 'Buyer'}
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            {online ? 'Online now' : 'Offline'}
          </span>
        </span>

        <button
          type="button"
          onClick={removeConversation}
          aria-label="Delete conversation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          }}
          // `overflow-x-hidden` is deliberate: a long unbroken string or a wide
          // attachment must never widen the scroller and push the timestamps and
          // the send button off the right edge.
          className="h-full space-y-2 overflow-y-auto overflow-x-hidden px-3.5 py-3"
        >
          {ordered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="font-grotesk text-sm font-semibold text-foreground">
                No messages yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Answer quickly — replies within a few hours are what turn a question into a sale.
              </p>
            </div>
          ) : (
            ordered.map((message) => {
              const mine = message.senderId === currentUser.uid;
              return (
                <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('min-w-0 max-w-[78%]', mine ? 'items-end' : 'items-start')}>
                    {message.messageType === 'product' && message.productId ? (
                      <ProductBubble productId={message.productId} />
                    ) : message.messageType === 'order' && message.orderId ? (
                      <OrderBubble orderId={message.orderId} />
                    ) : message.mediaUrl ? (
                      <MediaBubble message={message} />
                    ) : (
                      <div
                        className={cn(
                          'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                          mine
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border/70 bg-card text-foreground',
                        )}
                      >
                        {bodyOf(message)}
                      </div>
                    )}

                    <div
                      className={cn(
                        'mt-0.5 flex items-center gap-1.5 px-1 text-[10px] leading-none tabular-nums text-muted-foreground',
                        mine ? 'justify-end' : 'justify-start',
                      )}
                    >
                      {timeOf(message)}
                      {mine && message.isRead && (
                        <span className="inline-flex items-center gap-0.5 text-primary">
                          <CheckCheck className="h-3 w-3" />
                          Seen
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!atBottom && ordered.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to newest message"
            className="absolute bottom-3 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/70 bg-card/40 px-3 pb-3 pt-2.5 backdrop-blur-xl">
        {uploadPct !== null && (
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-primary">
            <span>Sending</span>
            <span className="tabular-nums">{Math.round(uploadPct)}%</span>
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="font-grotesk shrink-0 text-sm font-bold tabular-nums text-red-500">
              0:{String(recordingSeconds).padStart(2, '0')}
            </span>
            <span className="flex-1 truncate text-xs text-muted-foreground">Recording…</span>
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Stop and send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white"
            >
              <Square className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input ref={fileRef} type="file" hidden onChange={chooseFile} />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPct !== null}
              aria-label="Attach a file"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setPickOpen((v) => !v)}
              aria-label="Share a product"
              aria-expanded={pickOpen}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition',
                pickOpen
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Package className="h-4 w-4" />
            </button>

            {draft.trim() ? (
              <button
                type="button"
                onClick={submit}
                disabled={sending}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={uploadPct !== null}
                aria-label="Record a voice note"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Write a message…"
              aria-label="Message"
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        )}

        {pickOpen && (
          <ProductPicker
            onPick={async (productId) => {
              setPickOpen(false);
              try {
                await send({ messageType: 'product', productId });
                setAtBottom(true);
              } catch {
                toast({ variant: 'destructive', title: 'Could not share that product' });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Bubbles ─────────────────────────────────────────────────────────────── */

function ProductBubble({ productId }: { productId: string }) {
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'products', productId);
  }, [firestore, productId]);
  const { data: product } = useDoc<Product>(ref);

  if (!product) {
    return (
      <div className="w-52 rounded-2xl border border-border/70 bg-card p-3">
        <p className="text-xs italic text-muted-foreground">This product is no longer listed.</p>
      </div>
    );
  }

  return (
    <div className="w-52 overflow-hidden rounded-2xl border border-border/70 bg-card">
      <ListingThumb
        src={product.imageUrl}
        alt={product.name || 'Product image'}
        className="aspect-video w-full"
        icon={Package}
      />
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-foreground">{product.name}</p>
        <p className="font-grotesk mt-0.5 text-sm font-bold tabular-nums text-primary">
          {product.price?.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function OrderBubble({ orderId }: { orderId: string }) {
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'orders', orderId);
  }, [firestore, orderId]);
  const { data: order } = useDoc<Order>(ref);

  if (!order) {
    return (
      <div className="w-56 rounded-2xl border border-border/70 bg-card p-3">
        <p className="text-xs italic text-muted-foreground">This order is no longer available.</p>
      </div>
    );
  }

  return (
    <div className="w-56 overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Order
        </span>
        <OrderStatusPill status={order.orderStatus} />
      </div>
      <div className="p-3">
        <p className="truncate text-xs font-semibold text-foreground">
          {order.productName || 'Order'}
        </p>
        <p className="font-grotesk mt-1 text-base font-bold tabular-nums text-foreground">
          {order.totalAmount?.toLocaleString()}
        </p>
        {/* Fulfilment, not payment — a seller never pays their own invoice. */}
        <Link
          href="/app/seller/orders"
          className="mt-3 flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary-foreground"
        >
          Open in orders
        </Link>
      </div>
    </div>
  );
}

function MediaBubble({ message }: { message: ChatMessage }) {
  const meta = message.mediaMetadata;
  const isImage = meta?.type?.startsWith('image/');
  const isVideo = meta?.type?.startsWith('video/');
  const isAudio =
    message.messageType === 'voice' || !!meta?.type?.startsWith('audio/');

  // A recorded voice note must be playable in place. It previously fell
  // through to the generic file branch and rendered as a "Voice Note · 6 KB"
  // card — a seller could send one and neither party could hear it.
  if (isAudio) {
    return <VoiceBubble message={message} />;
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={message.mediaUrl}
        alt={meta?.name || 'Image'}
        className="max-h-64 w-full rounded-2xl border border-border/70 object-cover"
      />
    );
  }
  if (isVideo) {
    return (
      <video
        src={message.mediaUrl}
        controls
        className="max-h-64 w-full rounded-2xl border border-border/70 bg-black"
      />
    );
  }
  return (
    <a
      href={message.mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-52 items-center gap-2.5 rounded-2xl border border-border/70 bg-card p-3 transition hover:bg-secondary"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">
          {meta?.name || 'File'}
        </span>
        <span className="block text-[10px] text-muted-foreground">
          {meta?.size ? `${Math.round(meta.size / 1024)} KB` : 'Attachment'}
        </span>
      </span>
    </a>
  );
}

/**
 * Voice note, playable in place.
 *
 * The duration is written into `mediaMetadata.duration` by the sender (the
 * website does the same), but it is only a hint — so the player reads the real
 * length from the audio element once metadata loads and overwrites whatever was
 * stored. A note recorded before durations were recorded, or sent from a
 * surface that never set one, therefore still shows the right length.
 */
function VoiceBubble({ message }: { message: ChatMessage }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(
    message.mediaMetadata?.duration ?? 0,
  );

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  };

  const label = duration > 0 ? `${Math.round(duration)}s` : 'Voice';

  return (
    <div className="flex w-56 items-center gap-3 rounded-2xl border border-border/70 bg-card p-2.5">
      <audio
        ref={audioRef}
        src={message.mediaUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && Number.isFinite(el.duration)) {
            setProgress((el.currentTime / el.duration) * 100);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{playing ? 'Playing' : 'Voice note'}</span>
          <span className="tabular-nums">{label}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Picks from the signed-in seller's own catalogue.
 *
 * Scoped by `sellerId` — the rules reject a bare `list()` on `products`, and an
 * unscoped read would also offer the seller other people's stock to share.
 */
function ProductPicker({ onPick }: { onPick: (productId: string) => void }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: products } = useCollection<Product>(productsQuery);
  const list = products ?? [];

  return (
    <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border/70 bg-background p-2">
      {list.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          You have no listings to share yet. Create one first.
        </p>
      ) : (
        <div className="space-y-1">
          {list.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onPick(product.id)}
              className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-secondary"
            >
              <ListingThumb
                src={product.imageUrl}
                alt={product.name || 'Product image'}
                className="h-10 w-10 shrink-0 rounded-lg"
                icon={Package}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {product.name}
                </span>
                <span className="font-grotesk block text-xs font-bold tabular-nums text-primary">
                  {product.price?.toLocaleString()}
                </span>
              </span>
              <Send className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}