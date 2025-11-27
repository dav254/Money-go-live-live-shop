
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { ChatSystem } from '@/components/messages/chat-system';

export default function AdminChatLogsPage() {
  return (
    <AdminLayout>
      <div className="flex-1">
        <ChatSystem />
      </div>
    </AdminLayout>
  );
}
