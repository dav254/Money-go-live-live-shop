import { Badge } from '@/components/ui/badge';

const MAP: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  deleted: { label: 'Deleted', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  submitted: { label: 'Submitted', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  accepted: { label: 'Accepted', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
  declined: { label: 'Declined', className: 'bg-muted text-muted-foreground border-border' },
  withdrawn: { label: 'Withdrawn', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? MAP.draft;
  return (
    <Badge variant="outline" className={`shrink-0 text-[10px] font-black uppercase ${s.className}`}>
      {s.label}
    </Badge>
  );
}
