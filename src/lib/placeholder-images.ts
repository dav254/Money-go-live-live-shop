
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
 * Returns a standard, clean placeholder without misleading text.
 * This ensures the UI remains professional when media is missing.
 * @returns A string containing the URL of a neutral placeholder.
 */
export function getPlaceholderImage(): string {
  // Use a dark-themed, neutral placeholder without any "No Image" text overlay
  return 'https://placehold.co/600x400/111111/111111';
}
