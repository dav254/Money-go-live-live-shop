
'use client';

import React, { useState, useEffect } from 'react';
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
import { Check, SlidersHorizontal, ThumbsDown, ThumbsUp, X, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, where, setDoc, updateDoc } from 'firebase/firestore';
import type { ContentModerationItem, ContentModerationSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

const reasonVariant: { [key: string]: 'destructive' | 'secondary' | 'default' } = {
  'Potential Spam': 'secondary',
  'Inappropriate Language': 'destructive',
  'Policy Violation': 'default',
};

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Content Details</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export default function AdminAIContentPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const settingsRef = useMemoFirebase(() => doc(firestore, 'systemSettings', 'contentModeration'), [firestore]);
  const queueQuery = useMemoFirebase(() => query(collection(firestore, 'contentModerationQueue'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')), [firestore]);

  const { data: settingsData, isLoading: isLoadingSettings } = useDoc<ContentModerationSettings>(settingsRef);
  const { data: queue, isLoading: isLoadingQueue } = useCollection<ContentModerationItem>(queueQuery);
  
  const [settings, setSettings] = useState<Partial<ContentModerationSettings>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  const handleSettingChange = (key: keyof ContentModerationSettings, value: boolean) => {
      setSettings(prev => ({...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
        await setDoc(settingsRef, settings, { merge: true });
        toast({ title: 'Settings Saved', description: 'Content moderation settings have been updated.' });
    } catch (e) {
        console.error("Failed to save settings: ", e);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not update settings.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAction = async (itemId: string, newStatus: 'approved' | 'rejected') => {
    const itemRef = doc(firestore, 'contentModerationQueue', itemId);
    try {
        await updateDoc(itemRef, { status: newStatus });
        toast({ title: `Content ${newStatus}`, description: `The item has been marked as ${newStatus}.` });
    } catch (e) {
        console.error(`Failed to ${newStatus} item:`, e);
        toast({ variant: 'destructive', title: 'Action Failed' });
    }
  };
  
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            AI Content Moderation
            </h1>
             <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Moderation Queue</CardTitle>
                        <CardDescription>Content flagged by the AI for manual review.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingQueue ? <DataTableSkeleton /> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Content Details</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {queue && queue.length > 0 ? queue.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.contentType}</div>
                                                <div className="text-sm text-muted-foreground">
                                                  User: {item.userId.substring(0, 8)}... &middot; {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                                                </div>
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
                                                <Badge variant={reasonVariant[item.reason as keyof typeof reasonVariant] || 'default'}>{item.reason}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="text-green-500 hover:text-green-600" onClick={() => handleAction(item.id, 'approved')}>
                                                    <ThumbsUp className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleAction(item.id, 'rejected')}>
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
                        )}
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
                      {isLoadingSettings ? <Skeleton className="h-36 w-full" /> : (
                        <>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                              <Label htmlFor="spam-switch">Spam & Promotions</Label>
                              <Switch id="spam-switch" checked={settings.isSpamActive} onCheckedChange={(val) => handleSettingChange('isSpamActive', val)} />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                              <Label htmlFor="language-switch">Inappropriate Language</Label>
                              <Switch id="language-switch" checked={settings.isLanguageActive} onCheckedChange={(val) => handleSettingChange('isLanguageActive', val)} />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                              <Label htmlFor="policy-switch">Policy Violations</Label>
                              <Switch id="policy-switch" checked={settings.isPolicyViolationActive} onCheckedChange={(val) => handleSettingChange('isPolicyViolationActive', val)} />
                          </div>
                        </>
                      )}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}

    