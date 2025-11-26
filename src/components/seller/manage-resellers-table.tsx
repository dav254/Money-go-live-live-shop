
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

// Mock data to simulate reseller applications
const pendingApplications = [
    {
        id: 'app-1',
        reseller: { name: 'Super Reseller', username: '@superreseller', avatar: 'https://picsum.photos/seed/reseller1/40' },
        status: 'pending',
    },
    {
        id: 'app-2',
        reseller: { name: 'Nairobi Deals', username: '@nairobideals', avatar: 'https://picsum.photos/seed/reseller2/40' },
        status: 'pending',
    },
];

const approvedResellers = [
    {
        id: 'app-3',
        reseller: { name: 'Kenya Finds', username: '@kenyafinds', avatar: 'https://picsum.photos/seed/reseller3/40' },
        status: 'approved',
    },
];


export function ManageResellersTable() {
  
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
                        {pendingApplications.length > 0 ? (
                           pendingApplications.map(app => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={app.reseller.avatar} />
                                                <AvatarFallback>{app.reseller.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{app.reseller.name}</p>
                                                <p className="text-xs text-muted-foreground">{app.reseller.username}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="capitalize">{app.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button size="sm" variant="outline">Reject</Button>
                                            <Button size="sm">Approve</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                           ))
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
                       {approvedResellers.length > 0 ? (
                           approvedResellers.map(app => (
                               <TableRow key={app.id}>
                                   <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={app.reseller.avatar} />
                                                <AvatarFallback>{app.reseller.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{app.reseller.name}</p>
                                                <p className="text-xs text-muted-foreground">{app.reseller.username}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="capitalize bg-green-600/80">{app.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="destructive">Remove</Button>
                                    </TableCell>
                               </TableRow>
                           ))
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
