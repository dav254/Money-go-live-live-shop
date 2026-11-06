/**
 * Marketplace live sessions for the homepage.
 *
 * Currently live sessions only. The production homepage must call the
 * existing live-session endpoint. This is a stand-in list that defines the
 * card contract and the honest empty states.
 */

export interface LandingLiveSession {
  id: string;
  seller: string;
  title: string;
  thumbnail: string;
}

export const landingLiveSessions: LandingLiveSession[] = [
  {
    id: 'dummy-session-1',
    seller: 'Maison One',
    title: 'Live luxury drop',
    thumbnail:
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'dummy-session-2',
    seller: 'Nakuru Green',
    title: 'Highland coffee harvest',
    thumbnail:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  },
];
