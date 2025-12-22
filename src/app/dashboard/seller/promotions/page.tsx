
'use client';

import * as React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/dashboard/date-picker';
import { PlusCircle, Tag, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  expires: Date;
  status: 'active' | 'expired';
  isResellerOnly: boolean;
}

const initialCoupons: Coupon[] = [
  { id: '1', code: 'SUMMER24', type: 'percentage', value: 15, expires: new Date('2024-08-31'), status: 'active', isResellerOnly: false },
  { id: '2', code: 'RESELLNOW', type: 'fixed', value: 10, expires: new Date('2024-12-31'), status: 'active', isResellerOnly: true },
  { id: '3', code: 'WELCOME10', type: 'percentage', value: 10, expires: new Date('2023-12-31'), status: 'expired', isResellerOnly: false },
];

const CouponForm = ({ onSave, onCancel }: { onSave: (coupon: Coupon) => void, onCancel: () => void }) => {
  const [code, setCode] = React.useState('');
  const [type, setType] = React.useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = React.useState(10);
  const [expires, setExpires] = React.useState<Date | undefined>(new Date());
  const [isResellerOnly, setIsResellerOnly] = React.useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    if (!code || !value || !expires) {
      toast({ variant: 'destructive', title: 'Missing Fields' });
      return;
    }
    onSave({
      id: `coupon-${Date.now()}`,
      code: code.toUpperCase(),
      type,
      value,
      expires,
      status: 'active',
      isResellerOnly,
    });
  };
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Coupon Code</Label>
        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., NAIROBI10" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Discount Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="fixed">Fixed Amount (USD)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="value">Value</Label>
          <Input id="value" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Expiry Date</Label>
        <DatePicker date={expires} setDate={setExpires} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="reseller-only-switch" className="flex flex-col space-y-1">
            <span>Reseller Exclusive</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
                Only works with reseller affiliate links.
            </span>
        </Label>
        <Switch id="reseller-only-switch" checked={isResellerOnly} onCheckedChange={setIsResellerOnly} />
      </div>
       <DialogFooter>
          <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
          <Button type="button" onClick={handleSave}>Create Coupon</Button>
      </DialogFooter>
    </div>
  );
};

export default function SellerPromotionsPage() {
  const [coupons, setCoupons] = React.useState(initialCoupons);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const { toast } = useToast();

  const handleSaveCoupon = (coupon: Coupon) => {
    setCoupons(prev => [coupon, ...prev]);
    setIsFormOpen(false);
    toast({ title: 'Coupon Created!', description: `Code "${coupon.code}" is now active.` });
  };
  
  const handleDeleteCoupon = (couponId: string) => {
    setCoupons(prev => prev.filter(c => c.id !== couponId));
     toast({ title: 'Coupon Deleted'});
  }

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Promotions & Coupons
          </h1>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Coupon
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Coupon Code</DialogTitle>
                </DialogHeader>
                <CouponForm onSave={handleSaveCoupon} onCancel={() => setIsFormOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Tag /> My Coupons</CardTitle>
                <CardDescription>Manage your discount codes to drive sales and reward customers.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Audience</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {coupons.map(c => (
                            <TableRow key={c.id}>
                                <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                                <TableCell>{c.type === 'percentage' ? `${c.value}%` : `$${c.value}`}</TableCell>
                                <TableCell>{c.expires.toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className={c.status === 'active' ? 'bg-green-600/80' : ''}>
                                        {c.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {c.isResellerOnly ? (
                                        <Badge variant="outline" className="flex items-center gap-1.5 w-fit border-blue-500/50 text-blue-300">
                                            <Users className="h-3 w-3" /> Resellers
                                        </Badge>
                                    ) : 'All Customers'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCoupon(c.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

      </div>
    </SellerLayout>
  );
}
