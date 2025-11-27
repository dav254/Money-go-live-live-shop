
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminLayout } from '@/components/layout/admin-layout';
import { PlusCircle, KeyRound, Copy, Check, MoreHorizontal, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: {
    read: boolean;
    write: boolean;
  };
  createdAt: Date;
}

// --- Helper Functions ---
const generateApiKey = () => `sk_live_${[...Array(32)].map(() => Math.random().toString(36)[2]).join('')}`;

// --- Main Component ---
export default function AdminApiKeysPage() {
  const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([]);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const [newKeyName, setNewKeyName] = React.useState('');
  const [canReadKey, setCanReadKey] = React.useState(true);
  const [canWriteKey, setCanWriteKey] = React.useState(false);

  const [newlyGeneratedKey, setNewlyGeneratedKey] = React.useState<string | null>(null);
  const [hasCopied, setHasCopied] = React.useState(false);
  const { toast } = useToast();

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast({ variant: 'destructive', title: 'Key name is required.' });
      return;
    }

    const key = generateApiKey();
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      key: key,
      prefix: `${key.substring(0, 10)}...${key.substring(key.length - 4)}`,
      permissions: { read: canReadKey, write: canWriteKey },
      createdAt: new Date(),
    };

    setApiKeys(prev => [newKey, ...prev]);
    setNewlyGeneratedKey(key);
    
    // Reset form for next use, but don't close the main dialog
    setNewKeyName('');
    setCanReadKey(true);
    setCanWriteKey(false);
  };
  
  const handleCopyKey = () => {
    if (!newlyGeneratedKey) return;
    navigator.clipboard.writeText(newlyGeneratedKey).then(() => {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    });
  }

  const handleRevokeKey = (keyId: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== keyId));
    toast({ title: 'API Key Revoked', description: 'The key has been successfully revoked and can no longer be used.' });
  };
  
  const handleCloseDialog = () => {
      setIsFormOpen(false);
      setNewlyGeneratedKey(null);
  }

  const columns: ColumnDef<ApiKey>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <div className="font-semibold">{row.original.name}</div>
    },
    {
      accessorKey: 'prefix',
      header: 'Key Prefix',
       cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.prefix}</span>
    },
    {
      accessorKey: 'permissions',
      header: 'Permissions',
      cell: ({ row }) => (
        <div className="flex gap-2">
            {row.original.permissions.read && <Badge variant="secondary">Read</Badge>}
            {row.original.permissions.write && <Badge variant="outline">Write</Badge>}
        </div>
      )
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => row.original.createdAt.toLocaleDateString(),
    },
    {
        id: 'actions',
        cell: ({row}) => (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleRevokeKey(row.original.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Revoke Key
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
  ];

  const table = useReactTable({
    data: apiKeys,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            API Keys
          </h1>
          <Dialog open={isFormOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsFormOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newlyGeneratedKey ? 'Your New API Key' : 'Create a New API Key'}</DialogTitle>
                <DialogDescription>
                  {newlyGeneratedKey 
                    ? 'Copy this key and store it securely. You will not be able to see it again.'
                    : 'API keys grant access to your data. Only give them to trusted third-party services.'
                  }
                </DialogDescription>
              </DialogHeader>
                {newlyGeneratedKey ? (
                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Input value={newlyGeneratedKey} readOnly className="pr-12 font-mono"/>
                            <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleCopyKey}>
                                {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                         <Button onClick={handleCloseDialog} className="w-full">Done</Button>
                    </div>
                ) : (
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="key-name">Key Name</Label>
                        <Input id="key-name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g., External Analytics Service" />
                    </div>
                    <div className="space-y-2">
                        <Label>Permissions</Label>
                        <div className="space-y-2 rounded-md border p-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="read" checked={canReadKey} onCheckedChange={(checked) => setCanReadKey(!!checked)} />
                                <Label htmlFor="read" className="font-normal">Read access (Get data)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="write" checked={canWriteKey} onCheckedChange={(checked) => setCanWriteKey(!!checked)} />
                                <Label htmlFor="write" className="font-normal">Write access (Create, update, delete data)</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateKey}>Create Key</Button>
                    </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No API keys have been created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
