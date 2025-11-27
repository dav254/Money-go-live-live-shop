'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  ColumnFiltersState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Clock,
  ShieldAlert,
  XCircle,
  Info,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


type ErrorLog = {
  id: string;
  code: string;
  message: string;
  user: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  timestamp: string;
};

// --- Mock Data ---
const mockErrorLogs: ErrorLog[] = [
  { id: 'err-1', code: 'API-500', message: "Failed to process payment for order #ORD-123", user: 'Ben O.', severity: 'critical', timestamp: '2m ago' },
  { id: 'err-2', code: 'AUTH-003', message: "Token expiration for user session.", user: 'Aisha K.', severity: 'warning', timestamp: '15m ago' },
  { id: 'err-3', code: 'CLIENT-012', message: "Null reference in ProductImage component.", user: 'guest_user', severity: 'error', timestamp: '1h ago' },
  { id: 'err-4', code: 'DB-002', message: "Firestore query timeout on 'products' collection.", user: 'N/A', severity: 'error', timestamp: '3h ago' },
  { id: 'err-5', code: 'API-404', message: "Endpoint /api/seller/stats not found.", user: 'David E.', severity: 'warning', timestamp: 'Yesterday' },
  { id: 'err-6', code: 'INFO-001', message: "User password reset successful.", user: 'Charlie D.', severity: 'info', timestamp: 'Yesterday' },
];
// --- End Mock Data ---


const columns: ColumnDef<ErrorLog>[] = [
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => {
        const severity = row.original.severity;
        const variant: "destructive" | "secondary" | "outline" | "default" = {
            critical: "destructive",
            error: "destructive",
            warning: "secondary",
            info: "outline",
        }[severity] as any;
        const icon = {
            critical: <XCircle className="h-3 w-3" />,
            error: <AlertCircle className="h-3 w-3" />,
            warning: <ShieldAlert className="h-3 w-3" />,
            info: <Info className="h-3 w-3" />
        }[severity]
        
        return <Badge variant={variant} className="capitalize flex items-center gap-1.5"><span className="hidden sm:block">{icon}</span> {severity}</Badge>;
    },
     filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'code',
    header: 'Code',
  },
  {
    accessorKey: 'message',
    header: 'Message',
  },
  {
    accessorKey: 'user',
    header: 'User',
  },
  {
    accessorKey: 'timestamp',
    header: 'Timestamp',
  },
  {
      id: 'actions',
      cell: ({row}) => (
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Create Ticket from Error</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Mute this Error</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      )
  }
];

const StatCard = ({ title, value, icon: Icon, description, color }: { title: string, value: string, icon: React.ElementType, description: string, color?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function AdminErrorLogsPage() {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: mockErrorLogs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Error & Stability Logs
        </h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Errors (24h)" value="12" icon={AlertCircle} description="+5% from yesterday" color="text-destructive" />
            <StatCard title="Uptime (30d)" value="99.98%" icon={Clock} description="System-wide operational status." />
        </div>
        
        <div className="w-full">
             <div className="flex items-center py-4">
                <Tabs defaultValue="all" onValueChange={(value) => table.getColumn('severity')?.setFilterValue(value === 'all' ? '' : value)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="critical">Critical</TabsTrigger>
                    <TabsTrigger value="error">Error</TabsTrigger>
                    <TabsTrigger value="warning">Warning</TabsTrigger>
                  </TabsList>
                </Tabs>
            </div>
            <div className="rounded-md border">
            <Table>
                <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                        {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                            )}
                        </TableHead>
                    ))}
                    </TableRow>
                ))}
                </TableHeader>
                <TableBody>
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                            {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                            )}
                        </TableCell>
                        ))}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        No errors found for this filter.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}
