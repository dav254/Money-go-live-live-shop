
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Sparkles } from 'lucide-react';

export default function AiAutoResellPage() {
  return (
    <MainLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          AI Auto-Resell
        </h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot />
              AI-Powered Reselling (Premium)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <Sparkles className="h-12 w-12 text-primary mb-4" />
              <p className="text-muted-foreground max-w-md">
                Enable our AI to automatically promote your products across the platform, create ads, and generate marketing content.
              </p>
               <p className="text-sm text-primary font-bold mt-4">This is a premium feature.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
