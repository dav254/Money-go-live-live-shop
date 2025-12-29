
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const staticProducts = [
    { id: 'prod1', name: 'Vintage Leather Jacket', imageUrl: 'https://picsum.photos/seed/jacket/40', commission: 10, enabled: true },
    { id: 'prod2', name: 'Handmade Ceramic Mug', imageUrl: 'https://picsum.photos/seed/mug/40', commission: 10, enabled: false },
    { id: 'prod3', name: 'Retro Sunglasses', imageUrl: 'https://picsum.photos/seed/glasses/40', commission: 10, enabled: true },
    { id: 'prod4', name: 'Designer Handbag', imageUrl: 'https://picsum.photos/seed/bag/40', commission: 10, enabled: true },
];

export function CommissionSettingsTable() {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead className="text-right">Enable Reselling</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {staticProducts.map((product) => (
                    <TableRow key={product.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                                <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" />
                                <span>{product.name}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary">{product.commission}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Switch checked={product.enabled} aria-label={`Enable reselling for ${product.name}`}/>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
