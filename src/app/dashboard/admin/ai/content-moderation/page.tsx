
'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, SlidersHorizontal, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// --- Mock Data and Types ---
type ContentType = 'Product Description' | 'User Review' | 'Profile Bio';
type FlagReason = 'Potential Spam' | 'Inappropriate Language' | 'Policy Violation';

type ModerationItem = {
  id: string;
  type: ContentType;
  user: string;
  reason: FlagReason;
  content: string;
  date: string;
};

const initialQueue: ModerationItem[] = [
  { id: 'item-1', type: 'Product Description', user: 'seller_jane', reason: 'Potential Spam', content: '🔥🔥🔥 CHEAPEST IN TOWN!! BUY NOW!! 100% GUARANTEED 🚀🚀 www.get-rich-quick.com', date: '2m ago' },
  { id: 'item-2', type: 'User Review', user: 'buyer_mike', reason: 'Inappropriate Language', content: 'This seller is a total idiot, the product is garbage.', date: '30m ago' },
  { id: 'item-3', type: 'Profile Bio', user: 'new_user_xyz', reason: 'Policy Violation', content: 'Contact me on WhatsApp at 0712345678 for direct deals.', date: '1h ago' },
];

const reasonVariant: { [key in FlagReason]: 'destructive' | 'secondary' | 'default' } = {
  'Potential Spam': 'secondary',
  'Inappropriate Language': 'destructive',
  'Policy Violation': 'default',
};

// --- Component ---

export default function AdminAIContentPage() {
  const [queue, setQueue] = useState<ModerationItem[]>(initialQueue);

  const handleAction = (itemId: string, action: 'approve' | 'reject') => {
    // In a real app, you'd call an API here.
    // For this simulation, we'll just remove the item from the queue.
    setQueue(prevQueue => prevQueue.filter(item => item.id !== itemId));
  };
  
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          AI Content Moderation
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Moderation Queue</CardTitle>
                        <CardDescription>Content flagged by the AI for manual review.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Content Details</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {queue.length > 0 ? queue.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.type}</div>
                                            <div className="text-sm text-muted-foreground">User: {item.user} &middot; {item.date}</div>
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="content" className="border-b-0">
                                                    <AccordionTrigger className="text-xs py-1">Show Content</AccordionTrigger>
                                                    <AccordionContent className="p-2 bg-muted/50 rounded-md text-sm italic">
                                                        "{item.content}"
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={reasonVariant[item.reason]}>{item.reason}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="text-green-500 hover:text-green-600" onClick={() => handleAction(item.id, 'approve')}>
                                                <ThumbsUp className="h-4 w-4" />
                                            </Button>
                                             <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleAction(item.id, 'reject')}>
                                                <ThumbsDown className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            The moderation queue is clear. Good job!
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
             <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SlidersHorizontal /> Moderation Settings</CardTitle>
                        <CardDescription>Adjust the sensitivity of the AI model.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor="spam-switch">Spam & Promotions</Label>
                            <Switch id="spam-switch" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor="language-switch">Inappropriate Language</Label>
                            <Switch id="language-switch" defaultChecked />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor="policy-switch">Policy Violations</Label>
                            <Switch id="policy-switch" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}
