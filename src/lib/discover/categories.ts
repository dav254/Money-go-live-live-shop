/**
 * DISCOVER · CATEGORY VOCABULARY.
 *
 * The picker offers the platform's two existing taxonomies rather than a new
 * one: `PRODUCT_CATEGORIES` (labels stored on `products.category`) and
 * `SERVICE_CATEGORIES` (keys stored on `products.serviceCategory`). One control
 * carries both, which is why the option values differ in shape — a product
 * option is a label, a service option is a key.
 */

import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { SERVICE_CATEGORIES } from '@/lib/listings/limits';

export const productCategoryOptions: readonly string[] = PRODUCT_CATEGORIES;

export const serviceCategoryOptions: ReadonlyArray<{ value: string; label: string }> =
  SERVICE_CATEGORIES.map((category) => ({ value: category.key, label: category.label }));
