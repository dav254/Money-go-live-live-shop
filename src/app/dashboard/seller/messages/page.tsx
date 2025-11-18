
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { ChatSystem } from '@/components/messages/chat-system';

export default function SellerMessagesPage() {
  return (
    <SellerLayout>
        <ChatSystem />
    </SellerLayout>
  );
}
