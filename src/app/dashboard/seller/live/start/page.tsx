
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import Link from 'next/link';

export default function LiveStudioStartPage() {

  return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ready to Go Live?</CardTitle>
            <CardDescription>
              This is where you'll manage your live show. When you're ready,
              head to the main studio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/seller/studio">
                <Video className="mr-2 h-4 w-4" />
                Go to Live Studio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
  );
}
