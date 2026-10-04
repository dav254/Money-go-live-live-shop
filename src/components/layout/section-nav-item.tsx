'use client';

import * as React from 'react';
import { useAppSections } from '@/hooks/use-app-sections';
import { sectionForConsumerPath } from '@/lib/app-sections';

/**
 * Wraps a sidebar entry so it disappears when an admin has switched the section
 * off in App Manager.
 *
 * Rendered as nothing rather than hidden with CSS so the link is genuinely
 * absent from the accessibility tree and from a keyboard tab order — a
 * `hidden` class still leaves the item focusable.
 *
 * The route itself is separately blocked by SectionGate, so this is about not
 * offering a dead link, not about being the enforcement point.
 */
export function SectionNavItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const { isGoverned, isLoaded, canUse } = useAppSections();
  const section = React.useMemo(
    () => sectionForConsumerPath(href),
    [href]
  );

  // Before the toggles load, render the entry: defaulting to hidden would make
  // menus flicker on every navigation.
  if (!isGoverned || !isLoaded || !section) return <>{children}</>;
  if (!canUse(section)) return null;
  return <>{children}</>;
}