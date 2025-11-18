
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { ChatSystem } from '@/components/messages/chat-system';

export default function MessagesPage() {
  return (
    <BuyerLayout>
      <ChatSystem />
    </BuyerLayout>
  );
}
