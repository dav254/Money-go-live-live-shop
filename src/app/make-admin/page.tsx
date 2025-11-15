
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function MakeAdminPage() {
    const { user, isLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const handleMakeAdmin = async () => {
        if (!user) {
            toast({
                variant: 'destructive',
                title: 'Not Logged In',
                description: 'You must be logged in to become an admin.',
            });
            return;
        }

        try {
            const adminDocRef = doc(firestore, 'admins', user.uid);
            await setDoc(adminDocRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Admin',
                role: 'SuperAdmin',
                lastLogin: new Date().toISOString(),
            });

            toast({
                title: 'Success!',
                description: 'You have been promoted to a SuperAdmin.',
            });
            router.push('/admin-login-net');

        } catch (error: any) {
            console.error("Error making admin:", error);
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: error.message || 'Could not set admin role. Check Firestore rules.',
            });
        }
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-2xl py-12">
                <Card>
                    <CardHeader>
                        <CardTitle>One-Time Admin Setup</CardTitle>
                        <CardDescription>
                            This page is for the initial setup of the first administrator account.
                            Click the button below to grant your current user admin privileges.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading && <p>Loading user information...</p>}
                        {user && (
                            <div className="space-y-2">
                                <p><span className="font-semibold">Current User:</span> {user.displayName || user.email}</p>
                                <p><span className="font-semibold">User ID:</span> {user.uid}</p>
                            </div>
                        )}
                        {!user && !isLoading && <p className="text-destructive">Please log in or sign up first.</p>}
                    </CardContent>
                    <CardContent>
                        <Button onClick={handleMakeAdmin} disabled={!user || isLoading}>
                            Make Me SuperAdmin
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
