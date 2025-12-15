
'use client';

import { ProductUploadForm } from "@/components/seller/product-upload-form";
import { SellerLayout } from "@/components/layout/seller-layout";
import { useRouter } from "next/navigation";

export default function Product() {
  const router = useRouter();

  const handleFormSubmit = () => {
    // Navigate to the next step after the form is successfully submitted
    router.push('/seller/studio/preview');
  };

  return (
    <SellerLayout>
        <div className="p-4 md:p-6 bg-background min-h-screen">
            <ProductUploadForm onFormSubmit={handleFormSubmit} />
        </div>
    </SellerLayout>
  );
}
