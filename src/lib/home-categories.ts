import { PRODUCT_CATEGORIES } from '@/lib/constants';

/**
 * Copy already present in this repo; the marketplace needed its own varela
 * list. This reuses PRODUCT_CATEGORIES where they apply and adds the
 * publisher-facing categories.
 */

export const landingCategories = [
  { label: 'Fashion & Apparel', href: '/search?q=Fashion%20%26%20Apparel' },
  { label: 'Electronics & Gadgets', href: '/search?q=Electronics%20%26%20Gadgets' },
  { label: 'Home & Living', href: '/search?q=Home%20%26%20Living' },
  { label: 'Beauty & Personal Care', href: '/search?q=Beauty%20%26%20Personal%20Care' },
  { label: 'Food & Groceries', href: '/search?q=Food%20%26%20Groceries' },
  { label: 'Health & Wellness', href: '/search?q=Health%20%26%20Wellness' },
  { label: 'Baby & Kids', href: '/search?q=Baby%20%26%20Kids' },
  { label: 'Sports & Outdoors', href: '/search?q=Sports%20%26%20Outdoors' },
  { label: 'Art & Collectibles', href: '/search?q=Art%20%26%20Collectibles' },
  { label: 'Books & Stationery', href: '/search?q=Books%20%26%20Stationery' },
  { label: 'Automotive', href: '/search?q=Automotive' },
  { label: 'Services', href: '/categories?type=services' },
] as const;
