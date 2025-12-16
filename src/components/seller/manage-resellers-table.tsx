
'use client';

import * as React from 'react';
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
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import type { ResellerApplication, UserProfile } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const ResellerRow = ({ application }: { application: ResellerApplication }) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Fetch the specific reseller profile for this row
    const resellerProfileRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'userProfiles', application.resellerId);
    }, [firestore, application.resellerId]);
    
    const { data: reseller, isLoading: isLoadingProfile } = useDoc<UserProfile>(resellerProfileRef);


    const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
        if (!firestore) return;
        setIsUpdating(true);
        const appRef = doc(firestore, 'resellerApplications', application.id);
        try {
            await updateDoc(appRef, { status });
            toast({ title: 'Success', description: `Application has been ${status}.` });
        } catch (error) {
            console.error('Error updating application status:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update the application.' });
        } finally {
            setIsUpdating(false);
        }
    };
    
    if (isLoadingProfile) {
        return (
             <TableRow>
                <TableCell colSpan={3}>
                    <div className="flex items-center gap-3">
                         <Skeleton className="h-9 w-9 rounded-full" />
                         <div className="space-y-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                         </div>
                    </div>
                </TableCell>
            </TableRow>
        )
    }

    if (!reseller) return null; // Don't render if the profile can't be found

    return (
        <TableRow key={application.id}>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={reseller.profilePictureUrl} />
                        <AvatarFallback>{reseller.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{reseller.fullName}</p>
                        <p className="text-xs text-muted-foreground">@{reseller.username}</p>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                 <Badge variant={application.status === 'approved' ? 'default' : 'secondary'} className={`capitalize ${application.status === 'approved' ? 'bg-green-600/80' : ''}`}>
                    {application.status}
                </Badge>
            </TableCell>
            <TableCell className="text-right">
                {application.status === 'pending' && (
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('rejected')} disabled={isUpdating}>Reject</Button>
                        <Button size="sm" onClick={() => handleUpdateStatus('approved')} disabled={isUpdating}>Approve</Button>
                    </div>
                )}
                 {application.status === 'approved' && (
                     <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus('rejected')} disabled={isUpdating}>Remove</Button>
                )}
            </TableCell>
        </TableRow>
    )
}


export function ManageResellersTable() {
    const { user } = useUser();
    const firestore = useFirestore();

    const appsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'resellerApplications'), where('sellerId', '==', user.uid));
    }, [user, firestore]);
    
    const { data: applications, isLoading } = useCollection<ResellerApplication>(appsQuery);
    
    const pendingApplications = React.useMemo(() => applications?.filter(a => a.status === 'pending') || [], [applications]);
    const approvedResellers = React.useMemo(() => applications?.filter(a => a.status === 'approved') || [], [applications]);

  
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
                           pendingApplications.map(app => <ResellerRow key={app.id} application={app} />)
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
                           approvedResellers.map(app => <ResellerRow key={app.id} application={app} />)
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
