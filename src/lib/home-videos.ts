/**
 * Marketplace video discovery for the homepage.
 *
 * Published, accessible videos only. The production homepage must load these
 * from the existing video/feed APIs. This is a stand-in list for the
 * component contract.
 */

export interface LandingVideo {
  id: string;
  image: string;
  title: string;
  seller: string;
}

export const landingVideos: LandingVideo[] = [
  {
    id: 'dummy-luxury-5',
    image:
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=600&q=80',
    title: 'The NEW luxury drop',
    seller: 'Maison One',
  },
  {
    id: 'dummy-coffee-9',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    title: 'How we roast the highlands',
    seller: 'Nakuru Green',
  },
  {
    id: 'dummy-mobile-3',
    image:
      'https://images.unsplash.com/photo-1512453976591-35abb45a4cco?auto=format&fit=crop&w=600&q=80',
    title: 'Inside Kigali Forward',
    seller: 'Kigali Forward Studio',
  },
];
