'use client';

/**
 * VIDNOV · DISCOVERY
 *
 * The main customer-facing area: where everything sellers upload — products,
 * services, businesses and live streams — is discovered and bought.
 *
 * A vertical, full-screen, snap-scrolled feed. One listing per screen, one
 * gesture to move: up. That is the whole idea, and it is why this is a website
 * route rather than an app screen — the app shell clamps every screen to
 * `max-w-md`, which is right for a feed in your hand and wrong for the same
 * feed on a laptop.
 *
 * All of the behaviour lives in `components/discovery`, which the buyer and
 * seller apps render too. Same feed, three surfaces, no drift.
 */

import { DiscoverySection } from '@/components/discovery/discovery-section';

export default function BuyerDiscoveryPage() {
  return <DiscoverySection />;
}
