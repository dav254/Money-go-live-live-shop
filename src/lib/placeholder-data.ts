
import type { Seller, Product, VideoFeedItem, Comment, Category, Review, StoryHighlight } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getImage = (id: string) => {
  const image = PlaceHolderImages.find((img) => img.id === id);
  if (!image) {
    // Return a default or throw an error
    const defaultImage = PlaceHolderImages.find((img) => img.id === 'feed-video-1');
    return defaultImage!;
  }
  return image;
};

export const homepageSlides = [
    {
        id: 'slide-1',
        title: 'The Summer Collection',
        description: 'Discover the latest trends and vibrant styles to refresh your summer wardrobe. Limited time offers available now!',
        imageUrl: 'https://picsum.photos/seed/slide1/1600/700',
        imageHint: 'summer fashion collection',
        href: '/categories/fashion'
    },
    {
        id: 'slide-2',
        title: 'Top Tech Deals',
        description: 'Upgrade your gear with our exclusive discounts on the latest smartphones, headphones, and accessories.',
        imageUrl: 'https://picsum.photos/seed/slide2/1600/700',
        imageHint: 'tech gadgets sale',
        href: '/categories/electronics'
    },
    {
        id: 'slide-3',
        title: 'Home & Living Essentials',
        description: 'Transform your space with our curated collection of home decor, kitchenware, and more.',
        imageUrl: 'https://picsum.photos/seed/slide3/1600/700',
        imageHint: 'modern living room',
        href: '/categories/home'
    }
];

export const sellers: Seller[] = [
  {
    id: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
    name: "Aisha's Handbags",
    avatar: getImage('seller-avatar-1'),
    isVerified: true,
    rating: 4.9,
    reviewsCount: 1320,
    followers: 12500,
    location: "Nairobi, Kenya",
    joinedDate: "2022-08-15",
    bio: "Curated collection of handcrafted leather bags and accessories. Made with love, built to last. We believe in sustainable fashion and timeless design.",
    banner: getImage('seller-banner-1'),
    returnPolicy: "30-day returns. Item must be in original condition. Buyer pays return shipping.",
    deliveryPolicy: "Ships nationwide in 2-3 business days via Wells Fargo. Free shipping on orders over KES 5,000.",
    storeHours: "Mon-Fri: 9am - 6pm, Sat: 10am - 4pm",
    deliversFast: true,
  },
  {
    id: 'seller-2',
    name: 'TechUnboxed',
    avatar: getImage('seller-avatar-2'),
    isVerified: true,
    rating: 4.8,
    reviewsCount: 4500,
    followers: 55000,
    location: "Mombasa, Kenya",
    joinedDate: "2021-01-20",
    bio: "Your one-stop shop for the latest gadgets and tech accessories. Unbox the future. All products come with a 1-year warranty.",
    banner: getImage('seller-banner-2'),
    returnPolicy: "14-day returns for defective items. Please contact us for troubleshooting before returning.",
    deliveryPolicy: "Next-day delivery available in Mombasa. 3-5 days for other regions.",
    storeHours: "Online 24/7. Support available during business hours.",
    deliversFast: false,
  },
   {
    id: 'seller-3',
    name: 'Gourmet Delights',
    avatar: getImage('seller-avatar-3'),
    isVerified: false,
    rating: 4.7,
    reviewsCount: 890,
    followers: 8200,
    location: "Kisumu, Kenya",
    joinedDate: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString(), // New seller
    bio: "Bringing you the finest ingredients and gourmet food kits for a five-star home cooking experience.",
    banner: { id: 'seller-banner-3', description: 'Food banner', imageUrl: 'https://picsum.photos/seed/403/1200/400', imageHint: 'gourmet food' },
    deliversFast: true,
  },
];

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'Classic Leather Handbag',
    price: 850,
    originalPrice: 1000,
    image: getImage('product-handbag'),
    stock: 3,
    sellerId: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
  },
  {
    id: 'prod-2',
    name: 'NextGen Smartphone',
    price: 1200,
    image: getImage('product-phone'),
    stock: 15,
    sellerId: 'seller-2',
  },
  {
    id: 'prod-3',
    name: 'Gourmet Pasta Kit',
    price: 45,
    originalPrice: 55,
    image: getImage('product-gourmet-set'),
    stock: 30,
    sellerId: 'seller-3',
  },
  {
    id: 'prod-4',
    name: 'Urban Explorer Sneakers',
    price: 120,
    image: getImage('product-sneakers'),
    stock: 0, // Out of stock example
    sellerId: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
  },
  {
    id: 'prod-5',
    name: 'Chronograph Watch',
    price: 350,
    originalPrice: 420,
    image: getImage('product-watch'),
    stock: 10,
    sellerId: 'seller-2',
  },
  {
    id: 'prod-6',
    name: 'Noise-Cancelling Headphones',
    price: 250,
    image: getImage('product-headphones'),
    stock: 18,
    sellerId: 'seller-2',
  },
];

const comments: Comment[] = [
  {
    id: 'comment-1',
    user: { name: 'JohnD', avatar: getImage('commenter-avatar-1') },
    text: 'Is this available?',
  },
  {
    id: 'comment-2',
    user: { name: 'AminaK', avatar: getImage('commenter-avatar-2') },
    text: 'How much for delivery to CBD?',
  },
  {
    id: 'comment-3',
    user: { name: 'BenO', avatar: getImage('commenter-avatar-1') },
    text: 'Nice! I want one',
  },
];

export const feedItems: VideoFeedItem[] = [
  {
    id: 'feed-1',
    video: getImage('feed-video-1'),
    seller: sellers[0],
    viewers: 1300,
    likes: 124,
    product: products[0],
    comments: comments.slice(0, 2),
  },
  {
    id: 'feed-2',
    video: getImage('feed-video-2'),
    seller: sellers[1],
    viewers: 3400,
    likes: 567,
    product: products[1],
    comments: comments.slice(1, 3),
  },
  {
    id: 'feed-3',
    video: getImage('feed-video-3'),
    seller: sellers[2],
    viewers: 2100,
    likes: 340,
    product: products[2],
    comments: comments.slice(0, 1),
  },
];

export const categories: Category[] = [
    { id: 'fashion', name: 'Fashion', image: getImage('category-fashion') },
    { id: 'electronics', name: 'Electronics', image: getImage('category-electronics') },
    { id: 'food', name: 'Food', image: getImage('category-food') },
    { id: 'home', name: 'Home Goods', image: getImage('category-home') },
    { id: 'beauty', name: 'Beauty', image: getImage('category-beauty') },
    { id: 'art', name: 'Art & Collectibles', image: getImage('category-art') },
];


export const reviews: Review[] = [
    {
        id: 'review-1',
        author: 'Jane D.',
        avatar: '/avatars/jane.png',
        rating: 5,
        comment: 'Absolutely love my new handbag! The quality is amazing and it arrived so quickly. Highly recommend this seller!',
        date: '2024-08-10'
    },
    {
        id: 'review-2',
        author: 'Mike K.',
        avatar: '/avatars/mike.png',
        rating: 4,
        comment: 'Great product and fast shipping. The bag is slightly smaller than I expected, but still beautiful.',
        date: '2024-08-05'
    }
];

export const storyHighlights: StoryHighlight[] = [
    { id: 'sh-1', title: 'New Drops', imageUrl: 'https://picsum.photos/seed/story1/200/200' },
    { id: 'sh-2', title: 'On Sale', imageUrl: 'https://picsum.photos/seed/story2/200/200' },
    { id: 'sh-3', title: 'Best Sellers', imageUrl: 'https://picsum.photos/seed/story3/200/200' },
    { id: 'sh-4', title: 'Flash Deals', imageUrl: 'https://picsum.photos/seed/story4/200/200' },
    { id: 'sh-5', title: 'Re-stocked', imageUrl: 'https://picsum.photos/seed/story5/200/200' },
];
