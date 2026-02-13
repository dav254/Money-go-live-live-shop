
/**
 * @fileOverview Application-wide constants and configurations.
 */

export const PRODUCT_CATEGORIES = [
  "Fashion & Apparel",
  "Electronics & Gadgets",
  "Home & Living",
  "Beauty & Personal Care",
  "Food & Groceries",
  "Health & Wellness",
  "Baby & Kids",
  "Sports & Outdoors",
  "Art & Collectibles",
  "Books & Stationery",
  "Automotive",
  "Other"
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
