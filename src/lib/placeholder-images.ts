
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
 * Selects a random placeholder image URL from the available list.
 * This prevents errors when an item is missing an image.
 * @returns A string containing the URL of a random placeholder image.
 */
export function getPlaceholderImage(): string {
  if (!PlaceHolderImages || PlaceHolderImages.length === 0) {
    // Provide a generic fallback in case the JSON data is missing.
    return 'https://placehold.co/600x400/EEE/31343C?text=No_Image_Available';
  }
  const randomIndex = Math.floor(Math.random() * PlaceHolderImages.length);
  const item = PlaceHolderImages[randomIndex];
  
  // Handle both string array and object array formats
  if (typeof item === 'string') {
    return item;
  }
  
  // @ts-ignore - Handle potential object structure
  return item?.imageUrl || 'https://placehold.co/600x400/EEE/31343C?text=No_Image_Available';
}
