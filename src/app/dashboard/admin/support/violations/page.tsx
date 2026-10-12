
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { firestoreDate } from '@/lib/firestore-date';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, Eye, Ban, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { Complaint } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function AdminViolationsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const complaintsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'complaints'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: complaints, isLoading } = useCollection<Complaint>(complaintsQuery);

  const filtered = statusFilter === 'all'
    ? complaints
    : complaints?.filter(c => c.status === statusFilter);

  const stats = {
    total: complaints?.length || 0,
    open: complaints?.filter(c => c.status === 'open').length || 0,
    investigating: complaints?.filter(c => c.status === 'investigating').length || 0,
    resolved: complaints?.filter(c => c.status === 'resolved').length || 0,
  };

  const handleStatusChange = async (complaintId: string, newStatus: string) => {
    const ref = doc(firestore, 'complaints', complaintId);
    try {
      await updateDoc(ref, { status: newStatus });
      toast({ title: 'Status updated' });
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' });
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Support & Moderation: Reports & Violations
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and resolve user-submitted reports about products, sellers, buyers and content.
          </p>
        </div>

        {/* stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Reports', value: stats.total, color: 'text-foreground' },
            { label: 'Open', value: stats.open, color: 'text-amber-500' },
            { label: 'Investigating', value: stats.investigating, color: 'text-blue-500' },
            { label: 'Resolved', value: stats.resolved, color: 'text-emerald-500' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className={`mt-2 text-3xl font-grotesk font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* filter pills */}
        <div className="flex flex-wrap gap-2">
          {['all', 'open', 'investigating', 'resolved', 'dismissed'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        {/* table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk">Reports</CardTitle>
            <CardDescription>                {isLoading ? 'Loading…' : filtered?.length === 0 ? 'No reports match this filter.' : `${filtered?.length} report${filtered?.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered && filtered.length > 0 ? (
                    filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.complainantId?.slice(0, 8) || 'Unknown'}</TableCell>
                        <TableCell>{c.targetId?.slice(0, 8) || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{c.reason}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.status === 'resolved' ? 'default' : 'outline'}
                            className={`capitalize ${c.status === 'resolved' ? 'bg-emerald-500/80' : c.status === 'open' ? 'bg-amber-500/80' : ''}`}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {firestoreDate(c.createdAt)?.toLocaleDateString() ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status !== 'resolved' && c.status !== 'dismissed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-500 border-emerald-500/30"
                              onClick={() => handleStatusChange(c.id, 'resolved')}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Resolve
                            </Button>
                          )}
                          {c.status !== 'dismissed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-500/30"
                              onClick={() => handleStatusChange(c.id, 'dismissed')}
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" />
                              Dismiss
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No reports found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* guidance card */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-grotesk">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              How to handle reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p><strong>Open</strong> — New report needing review. Investigate within 24 hours.</p>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <p><strong>Investigating</strong> — You are looking into it. Gather evidence before deciding.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p><strong>Resolved</strong> — Action taken. The report is closed and the issue is addressed.</p>
            </div>
            <div className="flex items-start gap-3">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p><strong>Dismissed</strong> — Report was unfounded or outside policy. No action needed.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
