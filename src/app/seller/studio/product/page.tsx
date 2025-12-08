import ProductForm from "@/components/studio/ProductForm";
import { SellerLayout } from "@/components/layout/seller-layout";

export default function Product() {
  return (
    <SellerLayout>
        <div className="p-6 bg-black text-white min-h-screen">
        <h1 className="text-xl font-bold mb-4">Product Details</h1>
        <ProductForm />
        </div>
    </SellerLayout>
  );
}
