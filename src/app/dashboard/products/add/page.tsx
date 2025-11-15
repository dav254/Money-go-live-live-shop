import { MainLayout } from '@/components/layout/main-layout';
import { ProductUploadForm } from '@/components/seller/product-upload-form';

export default function AddProductPage() {
  return (
    <MainLayout>
      <div className="container mx-auto max-w-5xl py-8">
        <ProductUploadForm />
      </div>
    </MainLayout>
  );
}
