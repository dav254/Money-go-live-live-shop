
import * as admin from 'firebase-admin';

// A simplified Order structure, capturing only the necessary fields for commission calculation.
export interface Order {
    id: string;
    resellerId?: string; // The ID of the reseller who facilitated the sale.
    sellerId: string;
    buyerId: string;
    items: OrderItem[];
    // ... other order fields
}

// Represents a single item within an order.
export interface OrderItem {
    productId: string;
    name: string;
    quantity: number;
    price: number; // The price of the product at the time of sale.
    // ... other item fields
}

// The core structure for our new `products` collection documents.
export interface Product {
    id: string;
    isResellable?: boolean;   // Whether the product can be resold.
    commissionRate?: number; // The commission percentage (e.g., 10 for 10%).
    // ... other product fields
}

/**
 * Represents the definitive, immutable record of a commission-generating activity.
 * This serves as our financial ledger for reseller transactions.
 */
export interface ResellActivity {
    id: string;              // Unique ID for the activity (e.g., `{orderId}_{productId}`)
    orderId: string;           // The ID of the originating order.
    productId: string;         // The product that was sold.
    productName: string;       // The name of the product (for easier display).
    resellerId: string;        // The reseller who earned the commission.
    sellerId: string;          // The seller of the product.
    buyerId: string;           // The customer who bought the product.
    quantity: number;          // How many units were sold.
    pricePerUnit: number;      // The price of a single unit at the time of the sale.
    commissionRate: number;    // The commission percentage at the time of the sale.
    resellerEarns: number;     // The final calculated amount the reseller earned.
    sellerGets: number;        // The final calculated amount the seller received.
    createdAt: admin.firestore.FieldValue; // The timestamp of when the sale occurred.
    type: 'sale' | 'share' | 'click'; // The type of activity (starting with 'sale').
}
