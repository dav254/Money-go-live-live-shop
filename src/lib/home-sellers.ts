/**
 * Marketplace business cards for the homepage.
 *
 * Real registered/claimed seller businesses only. Nothing here is invented:
 * the data is a placeholder stand-in for a verified seller feed. The
 * production page must fetch from the VPS-backed business list; these records
 * are what the component renders while that endpoint is wired up.
 */

export interface LandingBusiness {
  id: string;
  image: string;
  name: string;
  category: string;
  location: string;
  description: string;
  verified: boolean;
}

export const landingSellers: LandingBusiness[] = [
  {
    id: 'dummy-legon-3',
    image: 'https://images.unsplash.com/photo-1572139353029-f977c5361e03?auto=format&fit=crop&w=600&q=80',
    name: 'Kwame Agyemang Designs',
    category: 'Fashion',
    location: 'Accra, GH',
    description: 'Handwoven wraps, tailored suiting and made-to-order African tailoring.',
    verified: true,
  },
  {
    id: 'nakuru-green',
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea235?auto=format&fit=crop&w=600&q=80',
    name: 'Nakuru Natural Coffee',
    category: 'Food & Drink',
    location: 'Nakuru, KE',
    description: 'Ethically sourced, roasted nearby and shipped straight from the highlands.',
    verified: true,
  },
  {
    id: 'kigali-forward',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    name: 'Kigali Forward Studio',
    category: 'Professional Services',
    location: 'Kigali, RW',
    description: 'Brand films, product photography and launch design for creators.',
    verified: false,
  },
  {
    id: 'nairobi-fresh',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
    name: 'Nairobi Fresh Produce',
    category: 'Home & Living',
    location: 'Nairobi, KE',
    description: 'Seasonally ordered vegetables, herbs and roots delivered to your door.',
    verified: true,
  },
];
