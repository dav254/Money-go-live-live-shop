import type { Seller, Product, VideoFeedItem, Comment, Category } from './types';
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

export const sellers: Seller[] = [
  {
    id: 'seller-1',
    name: "Aisha's Handbags",
    avatar: getImage('seller-avatar-1'),
    isVerified: true,
    rating: 4.9,
    reviewsCount: 1320,
    followers: 12500,
    location: "Nairobi, Kenya",
    joinedDate: "2022-08-15",
    bio: "Curated collection of handcrafted leather bags and accessories. Made with love, built to last.",
    banner: getImage('seller-banner-1'),
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
    bio: "Your one-stop shop for the latest gadgets and tech accessories. Unbox the future.",
    banner: getImage('seller-banner-2'),
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
    joinedDate: "2023-03-10",
    bio: "Bringing you the finest ingredients and gourmet food kits for a five-star home cooking experience.",
    banner: { id: 'seller-banner-3', description: 'Food banner', imageUrl: 'https://picsum.photos/seed/403/1200/400', imageHint: 'gourmet food' },
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
    sellerId: 'seller-1',
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
    stock: 25,
    sellerId: 'seller-1',
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
