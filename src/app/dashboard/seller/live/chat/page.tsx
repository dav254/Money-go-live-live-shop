
'use client';

import { SellerLayout } from "@/components/layout/seller-layout";
import { ChatSystem } from "@/components/messages/chat-system";

export default function SellerChatPage() {
  return (
    <SellerLayout>
        <div className="h-[calc(100vh-4rem)]">
            <ChatSystem />
        </div>
    </SellerLayout>
  );
}
