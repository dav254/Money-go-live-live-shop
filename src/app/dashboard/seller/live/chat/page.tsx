'use client';

import { SellerLayout } from "@/components/layout/seller-layout";
import SellerChat from "@/components/seller/SellerChat";

export default function SellerChatPage() {
  return (
    <SellerLayout>
        <div className="p-4">
            <SellerChat />
        </div>
    </SellerLayout>
  );
}