
'use client';

import { useUser, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { SupportTicket } from '@/lib/types';
import { useMemo } from 'react';
import { useFirestore } from '@/firebase';

const statusColors: { [key: string]: string } = {
    pending: 'bg-yellow-500',
    open: 'bg-blue-500',
    closed: 'bg-green-500',
};

function TicketItem({ ticket }: { ticket: SupportTicket }) {
    const createdAt = ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString() : 'N/A';

    return (
        <div className="flex items-center justify-between p-3 hover:bg-accent rounded-lg">
            <div className="flex items-center gap-3">
                <div className={cn("h-2 w-2 rounded-full", statusColors[ticket.status] || 'bg-gray-400')}></div>
                <div>
                    <p className="font-semibold capitalize">{ticket.issueType}</p>
                    <p className="text-xs text-muted-foreground">Opened on {createdAt}</p>
                </div>
            </div>
            <Badge variant={ticket.status === 'closed' ? 'outline' : 'default'} className={cn(
                ticket.status === 'pending' && 'bg-yellow-100 text-yellow-800',
                ticket.status === 'open' && 'bg-blue-100 text-blue-800',
                ticket.status === 'closed' && 'text-gray-500'
            )}>
                {ticket.status}
            </Badge>
        </div>
    );
}

export function MyTickets() {
    const { user } = useUser();
    const firestore = useFirestore();

    const ticketsQuery = useMemo(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'supportTickets'), where('userId', '==', user.uid));
    }, [user, firestore]);

    const { data: tickets, isLoading } = useCollection<SupportTicket>(ticketsQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Ticket />
                    My Tickets
                </CardTitle>
                <CardDescription>Check the status of your existing support tickets.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : tickets && tickets.length > 0 ? (
                    <div className="space-y-2">
                        {tickets.map(ticket => (
                            <TicketItem key={ticket.id} ticket={ticket} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <p className="text-muted-foreground mb-4">You have no open tickets.</p>
                        <Link href="#" className={cn(buttonVariants({ variant: 'outline' }))} onClick={(e) => { e.preventDefault(); document.querySelector('textarea[name="description"]')?.focus(); }}>
                            Create a New Ticket
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
