
'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

interface ResellerApplication {
  id: string;
  resellerId: string;
  sellerId: string;
  status: 'pending' | 'approved' | 'rejected';
  resellerName?: string;
  resellerAvatar?: string;
}

const ApplicationRow = ({ application }: { application: ResellerApplication & { reseller?: UserProfile } }) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = React.useState(false);

    const handleApplication = async (newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        setIsLoading(true);

        const applicationRef = doc(firestore, 'resellerApplications', application.id);
        const sellerShopRef = doc(firestore, 'sellerShops', application.sellerId);
        
        try {
            const batch = writeBatch(firestore);
            batch.update(applicationRef, { status: newStatus });
            
            if (newStatus === 'approved') {
                 // In a real app, you might add the reseller to a subcollection on the seller's shop doc
            }

            await batch.commit();

            toast({
                title: `Application ${newStatus}`,
                description: `The request from ${application.reseller?.fullName} has been ${newStatus}.`,
            });
        } catch (error) {
            console.error('Error handling application:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not process the application.' });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <TableRow>
            <TableCell>
                 <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={application.reseller?.profilePictureUrl} />
                        <AvatarFallback>{application.reseller?.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{application.reseller?.fullName}</p>
                        <p className="text-xs text-muted-foreground">@{application.reseller?.username}</p>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={application.status === 'pending' ? 'secondary' : application.status === 'approved' ? 'default' : 'destructive'} className="capitalize">{application.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
                {application.status === 'pending' && (
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleApplication('rejected')} disabled={isLoading}>Reject</Button>
                        <Button size="sm" onClick={() => handleApplication('approved')} disabled={isLoading}>Approve</Button>
                    </div>
                )}
            </TableCell>
        </TableRow>
    )
}

export function ManageResellersTable() {
  const { user } = useUser();
  const firestore = useFirestore();

  const applicationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'resellerApplications'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: applications, isLoading: isLoadingApplications } = useCollection<ResellerApplication>(applicationsQuery);
  
  const resellerIds = React.useMemo(() => {
      return applications ? [...new Set(applications.map(app => app.resellerId))] : [];
  }, [applications]);

  const resellersQuery = useMemoFirebase(() => {
    if (resellerIds.length === 0) return null;
    return query(collection(firestore, 'userProfiles'), where('id', 'in', resellerIds));
  }, [firestore, resellerIds]);

  const { data: resellers, isLoading: isLoadingResellers } = useCollection<UserProfile>(resellersQuery);

  const applicationsWithResellers = React.useMemo(() => {
      if (!applications || !resellers) return [];
      return applications.map(app => ({
          ...app,
          reseller: resellers.find(r => r.id === app.resellerId)
      }));
  }, [applications, resellers]);
  
  const isLoading = isLoadingApplications || isLoadingResellers;

  const pendingApplications = applicationsWithResellers.filter(a => a.status === 'pending');
  const approvedResellers = applicationsWithResellers.filter(a => a.status === 'approved');

  return (
    <div className="space-y-8">
        <div>
            <h3 className="text-lg font-semibold mb-2">Pending Requests</h3>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Reseller</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading requests...</TableCell></TableRow>
                        ) : pendingApplications.length > 0 ? (
                           pendingApplications.map(app => <ApplicationRow key={app.id} application={app} />)
                        ) : (
                             <TableRow><TableCell colSpan={3} className="h-24 text-center">No pending reseller requests.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
         <div>
            <h3 className="text-lg font-semibold mb-2">Approved Resellers</h3>
            <div className="rounded-md border">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Reseller</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading resellers...</TableCell></TableRow>
                        ) : approvedResellers.length > 0 ? (
                           approvedResellers.map(app => <ApplicationRow key={app.id} application={app} />)
                        ) : (
                             <TableRow><TableCell colSpan={3} className="h-24 text-center">You have not approved any resellers yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    </div>
  );
}
