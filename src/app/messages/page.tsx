import { MainLayout } from '@/components/layout/main-layout';
import { MessageSquare } from 'lucide-react';

export default function MessagesPage() {
  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h1 className="font-headline text-2xl font-bold">Your Messages</h1>
        <p className="max-w-xs text-muted-foreground">
          Select a conversation to start chatting with buyers and sellers.
        </p>
      </div>
    </MainLayout>
  );
}
