
import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

// The JSON data currently contains an array of strings for placeholderImages
export const PlaceHolderImages = data.placeholderImages;

/**
 * Returns a standard, non-confusing "No Image" placeholder.
 * This ensures buyers are not misled by random stock photos.
 * @returns A string containing the URL of a standard placeholder.
 */
export function getPlaceholderImage(): string {
  // Use a dark-themed, neutral placeholder that clearly indicates missing media
  return 'https://placehold.co/600x400/111111/FFFFFF?text=No+Product+Image';
}
