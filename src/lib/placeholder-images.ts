const FALLBACKS: Record<string, string> = {
  product: 'https://picsum.photos/seed/vn-product/400/500',
  seller: 'https://picsum.photos/seed/vn-seller/120/120',
  banner: 'https://picsum.photos/seed/vn-banner/1200/400',
  avatar: 'https://picsum.photos/seed/vn-avatar/120/120',
  video: 'https://picsum.photos/seed/vn-video/400/500',
  live: 'https://picsum.photos/seed/vn-live/400/500',
};

export function getPlaceholderImage(kind?: string): string {
  if (!kind) return FALLBACKS.product;
  return FALLBACKS[kind] ?? FALLBACKS.product;
}
