
import { MainLayout } from '@/components/layout/main-layout';

export default function AdminSupportTicketsPage() {
  return (
    <MainLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Support & Moderation: Support Tickets
        </h1>
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed p-12">
            <p className="text-muted-foreground">Support ticket queue will be here.</p>
        </div>
      </div>
    </MainLayout>
  );
}

    