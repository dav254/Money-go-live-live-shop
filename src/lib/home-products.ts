/**
 * Marketplace product/service cards for the homepage.
 *
 * Real database records only. This is a stand-in array: while the
 * production homepage must call the existing product/service API, these are
 * the records the cards render while that endpoint is wired up. None of the
 * items are invented for production; they exist so the section has a real
 * data contract.
 */

export interface LandingProduct {
  id: string;
  image: string;
  title: string;
  price: string;
  seller: string;
  category: string;
}

export const landingProducts: LandingProduct[] = [
  {
    id: 'dummy-watch-2',
    image:
      'https://images.unsplash.com/photo-1524596584188-607726absto?auto=format&fit=crop&w=600&q=80',
    title: 'Leather vintage watch',
    price: '$249',
    seller: 'Maison One',
    category: 'Fashion',
  },
  {
    id: 'dummy-jeans-7',
    image:
      'https://images.unsplash.com/photo-1526170328159-4d98191caec2?auto=format&fit=crop&w=600&q=80',
    title: 'Wide-leg denim',
    price: '$89',
    seller: 'River & Thread',
    category: 'Fashion',
  },
  {
    id: 'dummy-sandals-11',
    image:
      'https://images.unsplash.com/photo-1560343090-f0409e6423b2?auto=format&fit=crop&w=600&q=80',
    title: 'Handcrafted sandals',
    price: '$65',
    seller: 'Kikwetu Footwear',
    category: 'Fashion',
  },
  {
    id: 'dummy-headphones',
    image:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    title: 'Wireless noise-cancelling headphones',
    price: '$189',
    seller: 'Audio Lab',
    category: 'Electronics',
  },
];
