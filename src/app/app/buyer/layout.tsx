'use client';

import { BuyerAppShell } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER SECTION LAYOUT (app).
 *
 * Everything under `/app/buyer/*` renders inside the buyer shell — its own dark
 * top bar, its own floating pill nav, its own `.vn-buyer-scope` design system.
 * It is a sibling of `/app/seller`'s layout, not a variant of it: the two
 * layouts import different components and different CSS, so a change to one
 * cannot reach the other. Admin never enters the app at all.
 */
export default function BuyerSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BuyerAppShell>{children}</BuyerAppShell>;
}
