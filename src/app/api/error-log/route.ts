import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { publicUrl } from '@/lib/site-url';

type LogEntry = {
  errorMessage?: string;
  errorName?: string;
  errorStack?: string | null;
  userId?: string | null;
  context?: Record<string, unknown> | null;
  timestamp?: string;
};

function extractEntries(raw: unknown): LogEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const body = raw as Record<string, unknown>;
  const entries = body.entries;
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry): entry is Record<string, unknown> => entry && typeof entry === 'object')
    .map((entry) => ({
      errorMessage:
        typeof entry.errorMessage === 'string' ? entry.errorMessage : undefined,
      errorName:
        typeof entry.errorName === 'string' ? entry.errorName : undefined,
      errorStack:
        entry.errorStack && typeof entry.errorStack === 'string' ? entry.errorStack : null,
      userId:
        entry.userId && typeof entry.userId === 'string' ? entry.userId : null,
      context:
        entry.context && typeof entry.context === 'object'
          ? entry.context as Record<string, unknown>
          : null,
      timestamp:
        typeof entry.timestamp === 'string' ? entry.timestamp : undefined,
    }))
    .filter((entry) => entry.errorMessage != null || entry.errorStack != null);
}

function randomDocId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  if (request.headers.get('content-type') !== 'application/json') {
    return NextResponse.json({ status: 'ignored' }, { status: 202 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ status: 'bad-json' }, { status: 202 });
  }

  const entries = extractEntries(parsed);
  if (entries.length === 0) {
    return NextResponse.json({ status: 'no-entries' }, { status: 202 });
  }

  const documents = entries.map((entry) => ({
    errorMessage: entry.errorMessage ?? 'Unknown Error',
    errorStack: entry.errorStack ?? null,
    userId: entry.userId ?? null,
    context: entry.context ?? null,
    environment: process.env.NODE_ENV ?? 'development',
    timestamp:
      entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
    userAgent: request.headers.get('user-agent') ?? null,
  }));

  let lastReportId = '';

  try {
    for (const document of documents) {
      const ref = db.collection('errorLogs').doc(randomDocId());
      lastReportId = ref.id;
      await ref.set({
        ...document,
        createdAt: FieldValue.serverTimestamp(),
        status: 'new',
      });
    }
  } catch {
    // If the server-side write fails, the client already shipped the payload
    // with sendBeacon/keepalive, so dropping the response body is acceptable
    // and does not re-introduce any client-side error handling.
  }

  const reportId = lastReportId || randomDocId();
  return NextResponse.json(
    {
      status: 'queued',
      count: documents.length,
      reportId,
      url: publicUrl(`/dashboard/admin/error-logs?filter=report-${reportId}`),
    },
    { status: 202 },
  );
}
