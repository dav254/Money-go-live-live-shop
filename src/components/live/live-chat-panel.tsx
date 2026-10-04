'use client';

/**
 * LiveChatPanel — shared live chat (spec §26) for seller studio and buyer
 * viewer. Polls /api/live/[id]/chat and posts messages; private follow-ups
 * continue in the regular Vidnov messaging system.
 */

import * as React from 'react';
import { Send, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiveChatMessage } from '@/lib/live/types';

const REACTIONS = ['🔥', '❤️', '😂', '😮', '👏', '🛒'];

export function LiveChatPanel({
  streamId,
  userToken,
  className,
  compact = false,
}: {
  streamId: string | null;
  userToken: () => Promise<string>;
  className?: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = React.useState<LiveChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Poll (simple + robust on mobile networks).
  React.useEffect(() => {
    if (!streamId) return;
    let alive = true;
    const load = async () => {
      try {
        const token = await userToken();
        const res = await fetch(`/api/live/${streamId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { messages: LiveChatMessage[] };
        if (alive) setMessages(data.messages ?? []);
      } catch {
        // transient — next tick retries
      }
    };
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [streamId, userToken]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async (text: string) => {
    if (!streamId || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const token = await userToken();
      const res = await fetch(`/api/live/${streamId}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send.');
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-[11px] text-white/30">
            Say hi — the room is waiting.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-[12px] leading-snug">
            {m.kind === 'reaction' ? (
              <span className="text-lg">{m.message}</span>
            ) : (
              <p className="text-white/80">
                <span className={cn('font-bold', m.isSeller ? 'text-primary' : 'text-cyan-300')}>
                  {m.userName}
                </span>
                <span className="mx-1 text-white/30">·</span>
                {m.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        {!compact && (
          <div className="mb-2 flex gap-1">
            {REACTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void send(r)}
                className="rounded-lg px-1.5 py-1 text-base transition hover:scale-125"
                aria-label={`React ${r}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); void send(draft); }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            placeholder="Say something…"
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/60"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        {error && <p className="mt-1.5 text-[10px] font-semibold text-red-400">{error}</p>}
      </div>
    </div>
  );
}
