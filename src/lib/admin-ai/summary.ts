/**
 * Report list projection.
 *
 * A full report can be tens of kilobytes. A history screen only needs the
 * header, so lists return this and the detail screen fetches one report by id.
 */

export interface ReportSummary {
  id: string;
  title: string;
  status: string;
  model: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  preview: string;
  executed: false;
  proposedOnly: true;
}

export function summarizeReport(report: Record<string, unknown>): ReportSummary {
  const result = typeof report.result === 'string' ? report.result.replace(/\s+/g, ' ').trim() : '';
  return {
    id: String(report.id ?? ''),
    title: String(report.title ?? 'Untitled instruction'),
    status: String(report.status ?? 'completed'),
    model: String(report.model ?? 'unknown'),
    startedAt: String(report.startedAt ?? ''),
    completedAt: typeof report.completedAt === 'string' ? report.completedAt : null,
    error: typeof report.error === 'string' ? report.error : null,
    preview: result.slice(0, 280) + (result.length > 280 ? '…' : ''),
    // Re-asserted here so a malformed stored document can never render as
    // "executed" on the phone.
    executed: false,
    proposedOnly: true,
  };
}
