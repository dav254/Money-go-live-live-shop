'use client';

import ProductForm from "@/components/studio/ProductForm";
import { SellerLayout } from "@/components/layout/seller-layout";

export default function Product() {
  return (
    <SellerLayout>
        <div className="p-4 md:p-6 bg-background min-h-screen">
            <ProductForm />
        </div>
    </SellerLayout>
  );
}
