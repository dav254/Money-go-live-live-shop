'use client';

import * as React from 'react';
import { Link2, Loader2, Plus, Save, X } from 'lucide-react';
import {
  MAX_SOCIAL_LINKS,
  defaultLabelFor,
  mergeSocialLinks,
  newLinkId,
  normalizeSocialUrl,
  socialPlatformFor,
  type SocialLink,
} from '@/lib/social-links';
import { SOCIAL_LINK_ICONS } from '@/components/seller/social-link-icons';
import { SellerCard } from '@/components/app/seller/seller-app-shell';
import { cn } from '@/lib/utils';

/**
 * SELLER SOCIAL LINKS (`/app/seller/account`).
 *
 * ## The rule this screen exists to enforce
 *
 * *Any* link, *any* platform, as many as the seller wants — the list is
 * `{ label, url }`, not a set of named columns. A seller with a TikTok, a
 * Telegram, a YouTube channel and a Threads profile adds all four here, and
 * My shop shows all four the moment they press Save.
 *
 * The old design had exactly three inputs (Facebook, Instagram, Twitter), so
 * every other network a Kenyan seller actually runs their business on had
 * nowhere to go. Those columns are gone from this screen but still read by the
 * storefront via `mergeSocialLinks`, so nobody loses links they already had.
 *
 * Icons are chosen from the hostname, and an unknown host gets a generic link
 * icon rather than a rejection — an unrecognised site is still a link.
 */

const PLATFORM_ICONS = SOCIAL_LINK_ICONS;

/** Editable rows are held as plain objects so a half-typed URL can live safely. */
export function SocialLinksEditor({
  initialLinks,
  onSave,
}: {
  initialLinks: SocialLink[];
  onSave: (links: SocialLink[]) => Promise<void>;
}) {
  const [links, setLinks] = React.useState<SocialLink[]>(initialLinks);
  const [label, setLabel] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Seed once. The shop document arrives after the first paint, and an
  // unguarded effect would overwrite anything the seller has already typed.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setLinks(initialLinks);
  }, [initialLinks]);

  const full = links.length >= MAX_SOCIAL_LINKS;

  const add = () => {
    if (full) return;
    const normalized = normalizeSocialUrl(url);
    if (!normalized) {
      setError('That does not look like a link. Try instagram.com/yourstore');
      return;
    }
    if (links.some((l) => l.url.toLowerCase() === normalized.toLowerCase())) {
      setError('That link is already on your shop.');
      return;
    }
    setLinks([
      ...links,
      {
        id: newLinkId(),
        label: label.trim() || defaultLabelFor(normalized),
        url: normalized,
      },
    ]);
    setLabel('');
    setUrl('');
    setError(null);
    setSaved(false);
  };

  const remove = (id: string) => {
    setLinks(links.filter((l) => l.id !== id));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(links);
      setSaved(true);
      setError(null);
    } catch {
      // `onSave` has already shown the failure toast. Catching here keeps the
      // rejection from escaping the click handler as an unhandled rejection.
      setSaved(false);
      setError('Those links were not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="px-4">
      <SellerCard className="vn-app-card space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Link2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Your links</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Wherever your customers already find you — TikTok, WhatsApp, Telegram,
              YouTube, a website, anything. No platform list and no per-platform boxes:
              add as many as you like and they appear on your shop the moment you
              save.
            </p>
          </div>
        </div>

        {links.length > 0 ? (
          <ul className="space-y-2">
            {links.map((link) => {
              const platform = socialPlatformFor(link.url);
              const Icon = PLATFORM_ICONS[platform.id];
              return (
                <li
                  key={link.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-foreground transition-colors',
                      platform.hover,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {link.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {link.url}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(link.id)}
                    aria-label={`Remove ${link.label}`}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            No links yet. A shop with a WhatsApp number and a TikTok gets more
            messages than one with neither.
          </p>
        )}

        {/* ── Add ──────────────────────────────────────────────────────────── */}
        <div className="space-y-2 border-t border-border/70 pt-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <input
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setSaved(false);
              }}
              placeholder="TikTok (optional)"
              aria-label="Link name"
            />
            <input
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
                setSaved(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="tiktok.com/yourstore"
              inputMode="url"
              aria-label="Link address"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={add}
              disabled={full}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3.5 py-3 text-xs font-bold uppercase tracking-wider text-foreground transition hover:bg-secondary disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
              {full
                ? `That is the limit of ${MAX_SOCIAL_LINKS} links a shop can carry.`
                : 'Paste the address; we add https:// for you.'}
            </p>
          </div>

          {error && (
            <p className="text-[11px] font-medium text-destructive">{error}</p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || links.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save links'}
          </button>
        </div>
      </SellerCard>
    </section>
  );
}

/**
 * The links a shop document currently implies — legacy columns included.
 *
 * Used to seed the editor so a seller with only a Facebook URL saved a decade
 * ago still sees it listed (and can keep it) instead of starting from blank.
 */
export function linksFromShop(shop: unknown): SocialLink[] {
  return mergeSocialLinks((shop ?? null) as Parameters<typeof mergeSocialLinks>[0]);
}