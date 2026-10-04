'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BUSINESS AI ENTRY POINTS (spec §11–14).
 *
 * One small component so a product, service, request or business profile can
 * open AI Studio with the context already filled in — the business never
 * retypes what the platform already knows.
 */
export function CreateWithAiLink({
  mode = 'text-to-image',
  prompt,
  href,
  label = 'Create with AI',
  variant = 'default',
  className,
}: {
  mode?: 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'image-animation';
  prompt?: string;
  /** Override the destination entirely (e.g. buyers use /ai-studio). */
  href?: string;
  label?: string;
  variant?: 'default' | 'outline';
  className?: string;
}) {
  const base = href ?? '/dashboard/seller/ai-studio';
  const params = new URLSearchParams({ mode });
  if (prompt) params.set('prompt', prompt.slice(0, 400));
  const target = `${base}?${params.toString()}`;

  return (
    <Button asChild variant={variant} className={cn('font-black uppercase tracking-wide', className)}>
      <Link href={target}>
        <Sparkles className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}