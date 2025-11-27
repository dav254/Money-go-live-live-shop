
'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  AlertTriangle,
  CheckCircle2,
  ShieldOff,
  SlidersHorizontal,
  DollarSign,
  Users,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// --- Mock Data and Types ---

type Alert = {
  id: string;
  type: 'High-Value Order' | 'Multiple Logins' | 'New Device Payment';
  riskScore: number;
  user: string;
  timestamp: string;
  details: string;
};

type Activity = {
  id: string;
  type: 'Login' | 'Payment' | 'Profile Update';
  status: 'Approved' | 'Flagged';
  details: string;
};

const initialAlerts: Alert[] = [
  { id: 'al-1', type: 'High-Value Order', riskScore: 92, user: 'user123', timestamp: '2m ago', details: '$2,500 order from a new account.' },
  { id: 'al-2', type: 'Multiple Logins', riskScore: 85, user: 'seller_jane', timestamp: '15m ago', details: 'Logins from Kenya and Nigeria within 5 mins.' },
  { id: 'al-3', type: 'New Device Payment', riskScore: 78, user: 'buyer_mike', timestamp: '1h ago', details: 'First payment from a new device.' },
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

// --- Component ---

export default function AdminAIFraudPage() {
    const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [sensitivity, setSensitivity] = useState(75);
    const [isRealtimeActive, setIsRealtimeActive] = useState(true);

    // Simulate live activity feed
    useEffect(() => {
        if (!isRealtimeActive) return;

        const activityTypes = ['Login', 'Payment', 'Profile Update'];
        const users = ['user_abc', 'seller_xyz', 'buyer_123', 'guest_user'];

        const interval = setInterval(() => {
            const isFlagged = Math.random() > 0.95; // 5% chance of being flagged
            const newActivity: Activity = {
                id: `act-${Date.now()}`,
                type: activityTypes[Math.floor(Math.random() * activityTypes.length)] as Activity['type'],
                status: isFlagged ? 'Flagged' : 'Approved',
                details: `${users[Math.floor(Math.random() * users.length)]} initiated an action.`
            };

            setActivity(prev => [newActivity, ...prev].slice(0, 10)); // Keep last 10 activities

        }, 2500); // New activity every 2.5 seconds

        return () => clearInterval(interval);
    }, [isRealtimeActive]);

    return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          AI Fraud Detection Center
        </h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Value at Risk (24h)" value="$4,350" icon={DollarSign} description="Total value of flagged transactions." color="text-destructive" />
            <StatCard title="Blocked Transactions (24h)" value="17" icon={ShieldOff} description="High-confidence fraudulent payments stopped." />
            <StatCard title="Accounts Under Review" value="5" icon={Users} description="Accounts flagged for manual review." />
            <StatCard title="Model Accuracy" value="99.2%" icon={AlertTriangle} description="Based on historical data." />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>High-Risk Alerts</CardTitle>
                        <CardDescription>Actions requiring immediate attention, sorted by risk score.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Risk</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.map(alert => (
                                <TableRow key={alert.id} className={alert.riskScore > 90 ? 'bg-destructive/10' : ''}>
                                    <TableCell><Badge variant="destructive">{alert.riskScore}</Badge></TableCell>
                                    <TableCell className="font-medium">{alert.type}</TableCell>
                                    <TableCell>{alert.user}</TableCell>
                                    <TableCell className="text-muted-foreground">{alert.details}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="mr-2">Investigate</Button>
                                        <Button variant="secondary" size="sm">Dismiss</Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SlidersHorizontal /> Model Tuning</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                             <div className="flex justify-between">
                                <Label>Fraud Sensitivity</Label>
                                <span className="text-sm text-muted-foreground">{sensitivity}%</span>
                            </div>
                            <Slider value={[sensitivity]} onValueChange={(val) => setSensitivity(val[0])} max={100} step={1} />
                            <p className="text-xs text-muted-foreground">Higher values will flag more transactions but may increase false positives.</p>
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor="engine-status" className="flex flex-col">
                                <span>Real-time Engine</span>
                                <span className="font-normal text-xs text-muted-foreground">Enable or disable live analysis.</span>
                            </Label>
                            <Switch id="engine-status" checked={isRealtimeActive} onCheckedChange={setIsRealtimeActive} />
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Live Activity Feed</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 h-48 overflow-y-auto">
                        {activity.map(act => (
                            <div key={act.id} className="flex items-center gap-3 text-sm">
                                {act.status === 'Approved' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                                <span className="font-medium">{act.type}</span>
                                <span className="text-muted-foreground truncate">{act.details}</span>
                                <Badge variant={act.status === 'Approved' ? 'secondary' : 'default'} className="ml-auto">{act.status}</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}
