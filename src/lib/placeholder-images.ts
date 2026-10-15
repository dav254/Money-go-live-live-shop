const FALLBACKS: Record<string, string> = {
  product: '/placeholder-image.svg',
  seller: '/placeholder-avatar.svg',
  banner: '/placeholder-image.svg',
  avatar: '/placeholder-avatar.svg',
  video: '/placeholder-image.svg',
  live: '/placeholder-image.svg',
};

export function getPlaceholderImage(kind?: string): string {
  if (!kind) return FALLBACKS.product;
  return FALLBACKS[kind] ?? FALLBACKS.product;
}
