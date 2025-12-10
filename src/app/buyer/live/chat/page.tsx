'use client';

import { BuyerLayout } from "@/components/layout/buyer-layout";
import BuyerChat from "@/components/buyer/BuyerChat";

export default function BuyerChatPage() {
  return (
    <BuyerLayout>
        <div className="p-4">
            <BuyerChat />
        </div>
    </BuyerLayout>
  );
}