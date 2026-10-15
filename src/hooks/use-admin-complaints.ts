'use client';

import * as React from 'react';
import { useUser, useUserProfile } from '@/firebase';
import type { Complaint } from '@/lib/types';
import type { User } from 'firebase/auth';

/**
 * ONE CLIENT DOOR TO THE ADMIN COMPLAINTS API.
 *
 * The `complaints` collection has always been written server-side (see
 * `app/actions/complaint-actions.ts`), but every admin page used to read it
 * with client Firestore listeners. The rules deployed to the live project
 * deny client `list`, so the whole moderation surface was throwing
 * `permission-denied` toasts at signed-in admins. Every complaints reader now
 * goes through `/api/admin/support/complaints` (Admin SDK + admin check) via
 * these hooks — do not add direct client reads/writes of `complaints`.
 */

export type ComplaintStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

export interface ComplaintFilters {
  /** Only reports about this target type ('user' | 'product' | 'order' | …). */
  targetType?: string;
  /** Only reports in this moderation status. */
  status?: string;
}

export interface ComplaintCounts {
  open: number;
  openProducts: number;
  openUsers: number;
}

const EMPTY_COUNTS: ComplaintCounts = { open: 0, openProducts: 0, openUsers: 0 };

async function requestJson<T>(
  path: string,
  user: Pick<User, 'getIdToken'> | null,
  init?: RequestInit,
): Promise<T> {
  const token = user ? await user.getIdToken() : null;
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON body: keep the status message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Rows as the moderation pages consume them: `id` is always present (the API
 * fills it from the document id) and `createdAt` is a real `Date | null`
 * because the API serializes Timestamps as ISO strings.
 */
export type AdminComplaintRow = Omit<Complaint, 'id' | 'createdAt'> & {
  id: string;
  createdAt: Date | null;
};

function normalize(docs: Array<Partial<Pick<Complaint, 'id'>> & Omit<Complaint, 'id' | 'createdAt'>>): AdminComplaintRow[] {
  return docs.map((d) => {
    const raw = (d as { createdAt?: unknown }).createdAt;
    const parsed = typeof raw === 'string' ? new Date(raw) : raw;
    const date =
      parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : typeof parsed === 'object' && parsed !== null && typeof (parsed as { toDate?: () => Date }).toDate === 'function'
          ? (parsed as { toDate: () => Date }).toDate()
          : null;
    return { ...d, id: d.id ?? '', createdAt: date };
  });
}

/** Verified admin only — everything here hits an admin-only endpoint. */
function useVerifiedAdmin() {
  const { user } = useUser();
  const { userProfile, isLoading: profileLoading } = useUserProfile(user?.uid);
  const isAdmin =
    !!user &&
    !profileLoading &&
    (userProfile?.userRole === 'admin' || userProfile?.role === 'admin');
  return { user, isAdmin, profileLoading };
}

/**
 * Admin complaint list + moderation actions, fetched from the Admin-SDK API.
 *
 * Returns `Complaint[]` with `createdAt` normalized to a `Date | null` so
 * `firestoreDate(c.createdAt)` and `new Date(String(c.createdAt))` both work.
 * Mutations throw — wrap them in try/catch for your own toast.
 */
export function useAdminComplaints(filters: ComplaintFilters = {}) {
  const { user, isAdmin, profileLoading } = useVerifiedAdmin();
  const { targetType, status } = filters;

  const [complaints, setComplaints] = React.useState<AdminComplaintRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isFetching, setIsFetching] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!isAdmin) {
      setComplaints([]);
      setError(null);
      setHasLoaded(false);
      return;
    }
    setIsFetching(true);
    try {
      const params = new URLSearchParams();
      if (targetType) params.set('targetType', targetType);
      if (status) params.set('status', status);
      const qs = params.toString();
      const docs = await requestJson<Parameters<typeof normalize>[0]>(
        `/api/admin/support/complaints${qs ? `?${qs}` : ''}`,
        user,
      );
      setComplaints(normalize(Array.isArray(docs) ? docs : []));
      setError(null);
      setHasLoaded(true);
    } catch (e) {
      setComplaints([]);
      setError(e instanceof Error ? e.message : 'Could not load reports.');
      setHasLoaded(true);
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin, user, targetType, status]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const updateStatus = React.useCallback(
    async (complaintId: string, next: ComplaintStatus | string) => {
      await requestJson(`/api/admin/support/complaints/${encodeURIComponent(complaintId)}`, user, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      await reload();
    },
    [user, reload],
  );

  const remove = React.useCallback(
    async (complaintId: string) => {
      await requestJson(`/api/admin/support/complaints/${encodeURIComponent(complaintId)}`, user, {
        method: 'DELETE',
      });
      await reload();
    },
    [user, reload],
  );

  return {
    complaints,
    // True until the first successful/failed load completes for an admin;
    // false while the role resolves for everyone else (use profileLoading /
    // isAdmin for the "checking access" state).
    isLoading: profileLoading || (isAdmin && !hasLoaded),
    error,
    isAdmin,
    roleLoading: profileLoading,
    reload,
    updateStatus,
    remove,
  };
}

/** Badge counts for the admin sidebar (one request, no Firestore listeners). */
export function useAdminComplaintCounts() {
  const { user, isAdmin, profileLoading } = useVerifiedAdmin();
  const [counts, setCounts] = React.useState<ComplaintCounts>(EMPTY_COUNTS);

  React.useEffect(() => {
    let cancelled = false;
    if (!isAdmin) {
      setCounts(EMPTY_COUNTS);
      return;
    }
    (async () => {
      try {
        const data = await requestJson<ComplaintCounts>(
          '/api/admin/support/complaints/counts',
          user,
        );
        if (!cancelled) setCounts(data);
      } catch {
        if (!cancelled) setCounts(EMPTY_COUNTS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

  return { counts, isLoading: profileLoading };
}
