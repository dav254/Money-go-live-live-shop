
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth, useFirestore } from '@/firebase/provider'; 
import { User } from 'firebase/auth';

// A placeholder for a single product item
interface Product {
  id: string;
  name: string;
  imageUrl: string;
}

// --- Component: Product Gallery Item ---
const ProductGalleryItem: React.FC<{ product: Product, onSelect: (product: Product) => void }> = ({ product, onSelect }) => {
  return (
    <div 
      className="cursor-pointer border border-gray-300 rounded-lg overflow-hidden transition-transform duration-200 hover:scale-105" 
      onClick={() => onSelect(product)}
    >
      <img src={product.imageUrl} alt={product.name} className="w-full h-24 object-cover" />
      <div className="p-2">
        <p className="text-sm font-semibold truncate">{product.name}</p>
      </div>
    </div>
  );
};

// --- Component: Main Live Dashboard ---
const LiveStreamPage = () => {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Set up an auth state listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, [auth]);

  // 1. Fetch Seller's Products
  useEffect(() => {
    const fetchProducts = async () => {
      // Ensure we have the firestore instance and the user
      if (!firestore || !user) return;

      try {
        const q = query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const userProducts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Product));
        setProducts(userProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, [user, firestore]); // Rerun when user or firestore instance is available

  // 2. Setup Camera
  useEffect(() => {
    const setupCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
        }
      }
    };
    setupCamera();

    // Cleanup
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (!auth || !firestore) {
    return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Firebase Services...</div>
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex-1 flex flex-col p-4">
        <h1 className="text-2xl font-bold mb-4">Live Dashboard</h1>
        <div className="relative flex-1 bg-black rounded-lg overflow-hidden border border-gray-700">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"></video>
          {selectedProduct && (
            <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-75 p-4 rounded-lg flex items-center">
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-16 h-16 rounded-md mr-4"/>
              <div>
                <h3 className="text-lg font-bold">Featured Product</h3>
                <p>{selectedProduct.name}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="absolute top-2 right-2 text-white">✖</button>
            </div>
          )}
        </div>
      </div>
      <div className="w-80 bg-gray-800 p-4 border-l border-gray-700 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Your Products</h2>
        <div className="grid grid-cols-2 gap-4">
          {products.length > 0 ? (
            products.map(product => (
              <ProductGalleryItem key={product.id} product={product} onSelect={setSelectedProduct} />
            ))
          ) : (
            <p className="text-gray-400 col-span-2">No products found. Add some to get started!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveStreamPage;
