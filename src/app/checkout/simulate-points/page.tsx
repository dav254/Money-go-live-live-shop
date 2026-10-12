
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, increment, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { CheckCircle, Loader2, BadgeCent, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function SimulationContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
    const amount = parseFloat(searchParams?.get('amount') || '0');
    const gateway = searchParams?.get('gateway') || 'simulated';

    // Points mapping logic: $1 = 100 points
    const pointsToCredit = amount * 100;

    useEffect(() => {
        if (!user || !firestore || status !== 'processing') return;

        const creditPoints = async () => {
            try {
                // 1. Update user profile points
                const userRef = doc(firestore, 'userProfiles', user.uid);
                await updateDoc(userRef, {
                    aiPoints: increment(pointsToCredit)
                });

                // 2. Log payment in database
                await addDoc(collection(firestore, 'payments'), {
                    userId: user.uid,
                    amount: amount,
                    paymentMethod: `${gateway}_simulated`,
                    paymentStatus: 'completed',
                    paymentDate: serverTimestamp(),
                    transactionType: 'points-purchase',
                    transactionId: `SIM_PTS_${Date.now()}`,
                });

                setStatus('success');
                toast({ title: "Points Credited!", description: `Successfully added ${pointsToCredit} points to your wallet.` });
            } catch (error) {
                console.error("Simulation failed:", error);
                setStatus('failed');
            }
        };

        const timer = setTimeout(creditPoints, 2000);
        return () => clearTimeout(timer);
    }, [user, firestore, pointsToCredit, amount, gateway, status, toast]);

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md shadow-2xl border-primary/20">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        {status === 'processing' && <Loader2 className="h-16 w-16 animate-spin text-primary" />}
                        {status === 'success' && <CheckCircle className="h-16 w-16 text-green-500 animate-bounce" />}
                        {status === 'failed' && <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center"><CheckCircle className="h-10 w-10 text-red-500 rotate-45" /></div>}
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tighter">
                        {status === 'processing' && 'Processing Payment...'}
                        {status === 'success' && 'Payment Successful!'}
                        {status === 'failed' && 'Simulation Failed'}
                    </CardTitle>
                    <CardDescription>
                        {status === 'processing' && `Locking in your ${pointsToCredit} AI Points via ${gateway.toUpperCase()}...`}
                        {status === 'success' && `Your points have been added to your Go Earn wallet.`}
                        {status === 'failed' && 'There was an error processing the simulated points.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BadgeCent className="text-primary h-6 w-6" />
                            <span className="font-bold">Points Added</span>
                        </div>
                        <span className="text-xl font-black text-primary">+{pointsToCredit.toLocaleString()}</span>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button 
                        className="w-full h-12 font-black uppercase tracking-widest" 
                        disabled={status === 'processing'}
                        onClick={() => router.push('/dashboard/seller/ai-tools')}
                    >
                        Return to Tools <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function SimulatePointsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <SimulationContent />
        </Suspense>
    );
}
