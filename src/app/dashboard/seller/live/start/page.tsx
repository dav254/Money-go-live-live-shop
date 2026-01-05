
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, Clock } from "lucide-react";

export default function SellerLiveStudio() {

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Live Studio</CardTitle>
            <CardDescription>
                Start your live shopping event here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full bg-muted rounded-lg mb-4 flex flex-col items-center justify-center text-center p-8">
                 <Clock className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">Feature Coming Soon!</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Live video streaming is currently in development. We're working hard to bring you a reliable and high-quality streaming experience.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button className="w-full" disabled>
                  <Radio className="mr-2 h-4 w-4" />
                  GO LIVE
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
