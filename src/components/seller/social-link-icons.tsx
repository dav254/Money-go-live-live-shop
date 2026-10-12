'use client';

import * as React from 'react';
import {
  AtSign, Facebook, Ghost, Globe, Instagram, Linkedin, MessageCircle,
  Music2, Pin, Play, Send, SendHorizontal,
} from 'lucide-react';
import type { SocialPlatform } from '@/lib/social-links';

/**
 * HOST → ICON.
 *
 * Lives beside the components rather than inside `social-links.ts` so the
 * platform *rules* (which host means TikTok, which schemes are safe) stay
 * testable plain data while the icon set stays where React is.
 *
 * `social-links.ts` decides the platform from the URL; this file only turns
 * that decision into a glyph. The two are kept in step by the `id` key, which
 * is a closed union — adding a platform means adding it in both places, and
 * TypeScript says so.
 */
export const SOCIAL_LINK_ICONS: Record<SocialPlatform['id'], React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  whatsapp: MessageCircle,
  twitter: SendHorizontal,
  tiktok: Music2,
  youtube: Play,
  linkedin: Linkedin,
  telegram: Send,
  pinterest: Pin,
  threads: AtSign,
  snapchat: Ghost,
  reddit: MessageCircle,
  link: Globe,
};