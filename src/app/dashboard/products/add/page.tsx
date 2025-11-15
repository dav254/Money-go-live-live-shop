import { MainLayout } from '@/components/layout/main-layout';
import { GenerateDescriptionForm } from '@/components/dashboard/generate-description-form';

export default function AddProductPage() {
  return (
    <MainLayout>
      <div className="container mx-auto max-w-4xl py-8">
        <GenerateDescriptionForm />
      </div>
    </MainLayout>
  );
}
