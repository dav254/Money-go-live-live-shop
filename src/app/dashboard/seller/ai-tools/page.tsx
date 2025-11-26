'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { GenerateDescriptionForm } from '@/components/dashboard/generate-description-form';

export default function SellerAIToolsPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          AI Tools
        </h1>
        <GenerateDescriptionForm />
      </div>
    </SellerLayout>
  );
}
