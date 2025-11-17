
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// IMPORTANT: Replace with your actual service account key path
const serviceAccount = require('../../service-account.json');

// --- CONFIGURATION ---
const SELLER_ID = 'CKmHD5jv0dOevUJhJ8tM7akpSlF2';

// --- SCRIPT START ---

console.log("--- Firebase Seller Creation Script ---");

// Initialize Firebase Admin SDK
try {
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error: any) {
  if (error.code === 'app/duplicate-app') {
    console.log("Firebase Admin SDK already initialized.");
  } else {
    console.error("Error initializing Firebase Admin SDK:", error);
    process.exit(1);
  }
}

const db = getFirestore();

async function createSeller() {
  const sellerRef = db.collection('sellers').doc(SELLER_ID);

  console.log(`Checking for existing seller with ID: ${SELLER_ID}...`);
  const doc = await sellerRef.get();

  if (doc.exists) {
    console.log(`Seller with ID ${SELLER_ID} already exists. Aborting.`);
    return;
  }

  console.log("No existing seller found. Creating a new one...");

  const newSellerData = {
    name: "My Awesome Shop",
    avatarUrl: 'https://picsum.photos/seed/seller-avatar/400/400',
    bannerUrl: 'https://picsum.photos/seed/seller-banner/1200/400',
    isVerified: true,
    rating: 4.8,
    reviewsCount: 150,
    followers: 2300,
    location: "Nairobi, Kenya",
    joinedDate: new Date(),
    bio: "Welcome to my awesome shop! We sell the best products.",
    returnPolicy: "30-day returns accepted.",
    deliveryPolicy: "Ships nationwide in 2-3 business days.",
    storeHours: "9 AM - 5 PM, Mon-Fri",
    deliversFast: true,
  };

  try {
    await sellerRef.set(newSellerData);
    console.log("\n✅ Successfully created new seller profile!");
    console.log("New Seller Details:");
    console.log(JSON.stringify(newSellerData, null, 2));
    console.log(`\nYou can now view your shop at: /sellers/${SELLER_ID}`);
  } catch (error) {
    console.error("\n❌ Error creating seller document:", error);
  }
}

createSeller().then(() => {
  console.log("\n--- Script finished ---");
  // Force exit after a delay to ensure script termination
  setTimeout(() => process.exit(0), 2000);
}).catch(error => {
  console.error("An unexpected error occurred:", error);
  setTimeout(() => process.exit(1), 2000);
});
