
import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;

/**
 * Selects a random placeholder image URL from the available list.
 * This prevents errors when an item is missing an image.
 * @returns A string containing the URL of a random placeholder image.
 */
export function getPlaceholderImage(): string {
  if (PlaceHolderImages.length === 0) {
    // Provide a generic fallback in case the JSON data is missing.
    return '/placeholder.svg';
  }
  const randomIndex = Math.floor(Math.random() * PlaceHolderImages.length);
  return PlaceHolderImages[randomIndex].imageUrl;
}
