'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DotsHorizontalIcon, ReloadIcon, TrashIcon } from '@radix-ui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAdminComplaints, type ComplaintStatus } from '@/hooks/use-admin-complaints';

/**
 * Support & Moderation: seller/buyer issues.
 *
 * Data flows through `useAdminComplaints` → `/api/admin/support/complaints`
 * (Admin SDK + admin check). The deployed Firestore rules deny client
 * `list` on `/complaints`, which is what produced the red
 * `permission-denied` error this page used to throw on load — direct client
 * reads/writes of `complaints` from admin pages must not come back.
 */

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
  investigating: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
  resolved: 'bg-green-600/80 text-white border-transparent',
  dismissed: 'bg-muted text-muted-foreground border-transparent',
};

const UserCell = ({ userId }: { userId: string | undefined }) => {
  const firestore = useFirestore();
  const ref = useMemoFirebase(() => userId ? doc(firestore, 'userProfiles', userId) : null, [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(ref);

  if (!userId) return <span className="text-muted-foreground">—</span>;
  if (isLoading) return <Skeleton className="h-8 w-24" />;
  return <div className="font-medium">{user?.fullName || userId}</div>;
};

const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 7 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 7 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default function AdminSellerBuyerIssuesPage() {
  const { toast } = useToast();
  const {
    complaints: rows,
    isLoading,
    error: loadError,
    isAdmin,
    roleLoading,
    reload,
    updateStatus,
    remove,
  } = useAdminComplaints();

  const [pendingDelete, setPendingDelete] = React.useState<typeof rows[number] | null>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const { user } = useUser();

  // ── What was missing from this console: filters, search, detail, account actions ──
  const [statusFilter, setStatusFilter] = React.useState<'all' | ComplaintStatus>('all');
  const [search, setSearch] = React.useState('');
  const [detailRow, setDetailRow] = React.useState<typeof rows[number] | null>(null);
  const [pendingSuspend, setPendingSuspend] = React.useState<{
    row: typeof rows[number];
    next: 'suspended' | 'active';
  } | null>(null);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (statusFilter !== 'all' && (c.status || 'open') !== statusFilter) return false;
      if (!needle) return true;
      return `${c.reason ?? ''} ${c.description ?? ''} ${c.targetId ?? ''} ${c.complainantId ?? ''} ${c.orderId ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, statusFilter, search]);

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: rows.length, open: 0, investigating: 0, resolved: 0, dismissed: 0 };
    for (const c of rows) {
      const s = c.status || 'open';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const callApi = React.useCallback(
    async (path: string, init: RequestInit) => {
      const token = await user?.getIdToken();
      return fetch(path, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    },
    [user],
  );

  const handleAccountAction = async () => {
    if (!pendingSuspend?.row.targetId) return;
    const targetId = pendingSuspend.row.targetId;
    const next = pendingSuspend.next;
    setActionBusy(true);
    try {
      const res = await callApi(`/api/admin/users/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      toast({
        title: next === 'suspended' ? 'Account suspended' : 'Account reinstated',
        description: next === 'suspended' ? 'The reported user can no longer sign in.' : 'The user can sign in again.',
      });
      setPendingSuspend(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not update the account.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleStatusUpdate = async (complaintId: string, status: ComplaintStatus) => {
    setActionBusy(true);
    try {
      await updateStatus(complaintId, status);
      toast({ title: 'Updated', description: `Issue marked as ${status}.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not update issue status.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setActionBusy(true);
    try {
      await remove(pendingDelete.id);
      toast({ title: 'Deleted', description: 'The report has been removed.' });
      setPendingDelete(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not delete the report.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
              Support & Moderation: Seller & Buyer Issues
            </h1>
            <p className="text-sm text-muted-foreground">
              Reports filed by sellers and buyers about users, orders, listings and the platform.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={isLoading || !isAdmin}>
            <ReloadIcon className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isAdmin && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'open', 'investigating', 'resolved', 'dismissed'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className="capitalize"
                onClick={() => setStatusFilter(s)}
              >
                {s} <span className="ml-1 text-xs opacity-70">({statusCounts[s] ?? 0})</span>
              </Button>
            ))}
            <div className="ml-auto w-full max-w-xs">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reason, description or ID…"
                aria-label="Search issues"
              />
            </div>
          </div>
        )}

        {roleLoading || (isAdmin && isLoading) ? (
          <DataTableSkeleton />
        ) : !isAdmin ? (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
            You need an admin account to view seller and buyer issues.
          </div>
        ) : loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">Could not load issues</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <ReloadIcon className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><UserCell userId={c.complainantId} /></TableCell>
                    <TableCell><UserCell userId={c.targetId} /></TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.targetType === 'order' ? 'Order' : c.targetType === 'product' ? 'Product' : c.targetType === 'user' ? 'User' : 'Other'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{c.reason || c.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[c.status] ?? ''}>
                        {c.status || 'open'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.createdAt instanceof Date ? c.createdAt.toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={actionBusy}>
                            <DotsHorizontalIcon className="h-4 w-4" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setDetailRow(c)}>View details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={actionBusy} onClick={() => void handleStatusUpdate(c.id, 'investigating')}>
                            Mark as Investigating
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={actionBusy} onClick={() => void handleStatusUpdate(c.id, 'resolved')}>
                            Mark as Resolved
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={actionBusy} onClick={() => void handleStatusUpdate(c.id, 'dismissed')}>
                            Dismiss
                          </DropdownMenuItem>
                          {c.targetType === 'user' && c.targetId && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                disabled={actionBusy}
                                onClick={() => setPendingSuspend({ row: c, next: 'suspended' })}
                              >
                                Suspend reported user
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={actionBusy} onClick={() => setPendingSuspend({ row: c, next: 'active' })}>
                                Reinstate user
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={actionBusy}
                            onClick={() => setPendingDelete(c)}
                          >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Delete Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
            No seller or buyer issues found.
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.reason || pendingDelete.description || 'This report'}" will be permanently removed. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {actionBusy ? 'Deleting…' : 'Delete Report'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report details</DialogTitle>
            <DialogDescription>
              {detailRow
                ? `${detailRow.targetType === 'order' ? 'Order' : detailRow.targetType === 'product' ? 'Product' : detailRow.targetType === 'user' ? 'User' : 'Other'} report · ${detailRow.status || 'open'}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="font-medium">{detailRow.reason || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="whitespace-pre-wrap leading-relaxed">{detailRow.description || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reporter</p>
                  <p className="truncate font-mono text-xs">{detailRow.complainantId || '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
                  <p className="truncate font-mono text-xs">{detailRow.targetId || '—'}</p>
                </div>
              </div>
              {detailRow.orderId && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order</p>
                  <p className="font-mono text-xs">{detailRow.orderId}</p>
                </div>
              )}
              {detailRow.createdAt instanceof Date && (
                <p className="text-xs text-muted-foreground">Filed {detailRow.createdAt.toLocaleString()}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSuspend} onOpenChange={(open) => !open && setPendingSuspend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSuspend?.next === 'suspended' ? 'Suspend this account?' : 'Reinstate this account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSuspend?.next === 'suspended'
                ? 'They will no longer be able to sign in until reinstated.'
                : 'They will be able to sign in again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleAccountAction();
              }}
            >
              {pendingSuspend?.next === 'suspended' ? 'Suspend' : 'Reinstate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
