
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
  Loader2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, setDoc } from 'firebase/firestore';
import type { AIFraudAlert, FraudDetectionSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// --- Mock Data for stats ---
const stats = {
  valueAtRisk: "4,350",
  blockedTransactions: "17",
  accountsUnderReview: "5",
  modelAccuracy: "99.2%",
};

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

const AlertsTableSkeleton = () => (
    <div className="rounded-md border">
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
                {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-9 w-40 ml-auto" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
)

export default function AdminAIFraudPage() {
    const { toast } = useToast();
    const firestore = useFirestore();

    const settingsRef = useMemoFirebase(() => doc(firestore, 'systemSettings', 'fraudDetection'), [firestore]);
    const alertsQuery = useMemoFirebase(() => query(collection(firestore, 'fraudAlerts'), orderBy('riskScore', 'desc')), [firestore]);

    const { data: settingsData, isLoading: isLoadingSettings } = useDoc<FraudDetectionSettings>(settingsRef);
    const { data: alerts, isLoading: isLoadingAlerts } = useCollection<AIFraudAlert>(alertsQuery);

    const [isRealtimeActive, setIsRealtimeActive] = useState(true);
    const [sensitivity, setSensitivity] = useState(75);
    const [isSaving, setIsSaving] = useState(false);
    const [activity, setActivity] = useState<{ id: string; type: string; status: 'Approved' | 'Flagged'; details: string }[]>([]);


    useEffect(() => {
        if (settingsData) {
            setIsRealtimeActive(settingsData.isEngineActive ?? true);
            setSensitivity(settingsData.sensitivity ?? 75);
        }
    }, [settingsData]);

     const handleSaveChanges = async () => {
        setIsSaving(true);
        const newSettings = { isEngineActive: isRealtimeActive, sensitivity };
        try {
            await setDoc(settingsRef, newSettings, { merge: true });
            toast({ title: 'Settings Saved', description: 'Fraud detection settings have been updated.' });
        } catch (e) {
            console.error("Failed to save settings: ", e);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not update settings.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    // Simulate live activity feed
    useEffect(() => {
        if (!isRealtimeActive) return;
        const interval = setInterval(() => {
            const activityTypes = ['Login', 'Payment', 'Profile Update'];
            const users = ['user_abc', 'seller_xyz', 'buyer_123', 'guest_user'];
            const newActivity = {
                id: `act-${Date.now()}`,
                type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
                status: Math.random() > 0.95 ? 'Flagged' : 'Approved',
                details: `${users[Math.floor(Math.random() * users.length)]} initiated an action.`
            } as any;
            setActivity(prev => [newActivity, ...prev].slice(0, 10));
        }, 2500);
        return () => clearInterval(interval);
    }, [isRealtimeActive]);

    return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
              AI Fraud Detection Center
            </h1>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Value at Risk (24h)" value={`$${stats.valueAtRisk}`} icon={DollarSign} description="Total value of flagged transactions." color="text-destructive" />
            <StatCard title="Blocked Transactions (24h)" value={stats.blockedTransactions} icon={ShieldOff} description="High-confidence fraudulent payments stopped." />
            <StatCard title="Accounts Under Review" value={stats.accountsUnderReview} icon={Users} description="Accounts flagged for manual review." />
            <StatCard title="Model Accuracy" value={stats.modelAccuracy} icon={AlertTriangle} description="Based on historical data." />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>High-Risk Alerts</CardTitle>
                        <CardDescription>Actions requiring immediate attention, sorted by risk score.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoadingAlerts ? <AlertsTableSkeleton /> : (
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
                                    {alerts && alerts.length > 0 ? alerts.map(alert => (
                                    <TableRow key={alert.id} className={alert.riskScore > 90 ? 'bg-destructive/10' : ''}>
                                        <TableCell><Badge variant="destructive">{alert.riskScore}</Badge></TableCell>
                                        <TableCell className="font-medium">{alert.type}</TableCell>
                                        <TableCell>{alert.userId}</TableCell>
                                        <TableCell className="text-muted-foreground">{alert.details}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="mr-2">Investigate</Button>
                                            <Button variant="secondary" size="sm">Dismiss</Button>
                                        </TableCell>
                                    </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                No high-risk alerts at the moment.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                         )}
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SlidersHorizontal /> Model Tuning</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoadingSettings ? (
                            <div className="space-y-4">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
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

    