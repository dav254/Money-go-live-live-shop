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

export const KENYA_BANKS = [
    { name: "Equity Bank", code: "068" },
    { name: "KCB Bank", code: "001" },
    { name: "Co-operative Bank", code: "011" },
    { name: "NCBA Bank", code: "007" },
    { name: "Standard Chartered", code: "002" },
    { name: "Absa Bank", code: "003" },
    { name: "Stanbic Bank", code: "031" },
    { name: "I&M Bank", code: "061" },
    { name: "Family Bank", code: "070" },
    { name: "Diamond Trust Bank", code: "063" },
].sort((a, b) => a.name.localeCompare(b.name));
