'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { products as placeholderProducts } from '@/lib/placeholder-data';
import Image from 'next/image';

// This is a simplified version of the Product type for this demo page
const products = [
  {
    id: 1,
    name: 'Reusable Adult Diaper',
    price: 350,
    stock: 22,
    status: 'Active',
    views: 244,
    image: { imageUrl: 'https://picsum.photos/seed/p1/150/150', imageHint: 'diaper product' },
  },
  {
    id: 2,
    name: 'Premium Wheelchair',
    price: 900,
    stock: 0,
    status: 'Out of Stock',
    views: 1000,
    image: { imageUrl: 'https://picsum.photos/seed/p2/150/150', imageHint: 'wheelchair product' },
  },
  {
    id: 3,
    name: 'Classic Leather Handbag',
    price: 850,
    stock: 15,
    status: 'Active',
    views: 1500,
    image: { imageUrl: 'https://picsum.photos/seed/p3/150/150', imageHint: 'handbag product' },
  }
];

export default function SellerDashboardPage() {
  return (
    <MainLayout>
      <div className="p-4 bg-background min-h-full">
        {/* Seller Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image
              src="https://picsum.photos/seed/avatar/50/50"
              width={48}
              height={48}
              alt="Seller Avatar"
              className="w-12 h-12 rounded-full object-cover"
              data-ai-hint="seller avatar"
            />
            <div>
              <h2 className="text-lg font-bold font-headline">Seller Store</h2>
              <p className="text-sm text-muted-foreground">Wallet: KSh 4,200</p>
            </div>
          </div>

          <Button variant="destructive" className="rounded-xl font-bold">
            Go Live
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto mb-4 text-sm pb-2">
          {["My Products", "Videos", "Live", "Orders", "Analytics"].map((tab) => (
            <Button
              key={tab}
              variant={tab === 'My Products' ? 'default' : 'secondary'}
              className="rounded-xl shadow-sm whitespace-nowrap"
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* Add Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Button className="font-semibold" style={{ backgroundColor: '#2563eb' }}>Add Product</Button>
          <Button className="font-semibold" style={{ backgroundColor: '#7c3aed' }}>Add Video</Button>
          <Button className="font-semibold" style={{ backgroundColor: '#16a34a' }}>Add Live</Button>
        </div>

        {/* Product List */}
        <div className="space-y-4">
          <h3 className="font-headline text-xl font-bold">My Products</h3>
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-card p-4 rounded-xl shadow-md flex gap-4 items-center"
            >
              <Image 
                src={p.image.imageUrl} 
                width={80}
                height={80}
                alt={p.name}
                className="w-20 h-20 rounded-lg object-cover"
                data-ai-hint={p.image.imageHint}
              />

              <div className="flex-1">
                <h3 className="font-bold font-headline">{p.name}</h3>
                <p className="font-semibold text-primary">KSh {p.price.toLocaleString()}</p>

                <div className="text-sm text-muted-foreground mt-1 flex gap-4">
                    <span>Stock: {p.stock}</span>
                    <span>Views: {p.views}</span>
                </div>
                
                <p
                  className={`text-sm mt-1 font-bold ${
                    p.status === "Active" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {p.status}
                </p>
              </div>
                <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="w-full">
                    Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="w-full">
                    Delete
                    </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
