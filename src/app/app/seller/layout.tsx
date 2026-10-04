'use client';

import { SellerAppShell } from '@/components/app/seller/seller-app-shell';

/**
 * SELLER SECTION LAYOUT (app).
 *
 * Everything under `/app/seller/*` renders inside the seller shell — its own
 * top bar, its own ember tab bar, its own `.vn-seller-scope` design system.
 * The buyer section (when it is built) gets a sibling `layout.tsx` under
 * `/app/buyer` with a different shell, so the two can never share a layout,
 * a nav or a colour treatment. Admin never enters the app at all.
 */
export default function SellerSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SellerAppShell>{children}</SellerAppShell>;
}
