/**
 * Marketplace vocabularies for the Android seller tools.
 *
 * These are the same category names the website's upload form and discovery
 * filters use (`@/lib/constants` in the web project). They are duplicated here
 * deliberately: the mobile app is a separate bundle and must not import server
 * code, and a category must mean exactly one thing on both surfaces.
 */

export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion & Apparel',
  'Home & Living',
  'Beauty & Personal Care',
  'Health & Wellness',
  'Food & Beverages',
  'Baby & Kids',
  'Sports & Outdoors',
  'Automotive',
  'Books & Stationery',
  'Jewellery & Accessories',
  'Art & Crafts',
  'Agriculture',
  'Digital Goods',
  'Other',
] as const;

export const SERVICE_CATEGORIES = [
  'Repairs & Maintenance',
  'Beauty & Grooming',
  'Cleaning',
  'Events & Catering',
  'Transport & Delivery',
  'Construction & Trades',
  'Professional Services',
  'Tutoring & Coaching',
  'Creative & Design',
  'Technology',
  'Health Services',
  'Other',
] as const;

export const BUSINESS_CATEGORIES = [
  'Retail shop',
  'Online store',
  'Restaurant or food',
  'Beauty & grooming',
  'Repairs & trades',
  'Professional services',
  'Creative studio',
  'Agriculture',
  'Transport',
  'Education',
  'Health',
  'Other',
] as const;

/** Currencies the marketplace lists in; the code is shown, never a symbol guess. */
export const CURRENCIES = ['KES', 'UGX', 'TZS', 'NGN', 'GHS', 'ZAR', 'USD', 'EUR', 'GBP'] as const;

export const CURRENCY_DEFAULT = 'KES';

export const LISTING_CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
] as const;

export const DELIVERY_CHOICES = [
  { value: 'delivery', label: 'Delivery available' },
  { value: 'pickup', label: 'Pickup available' },
  { value: 'either', label: 'Delivery or pickup' },
] as const;

export const BUSINESS_TYPES = [
  { value: 'physical', label: 'Physical shop' },
  { value: 'online', label: 'Online only' },
  { value: 'both', label: 'Shop and online' },
] as const;

export const OFFERING_TYPES = [
  { value: 'products', label: 'Products' },
  { value: 'services', label: 'Services' },
  { value: 'both', label: 'Products and services' },
] as const;
