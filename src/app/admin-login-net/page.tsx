
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { KeyRound, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/firebase/auth/use-user';
import React from 'react';


const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function AdminLoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user: currentUser } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    signInWithEmailAndPassword(auth, values.email, values.password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        const adminDocRef = doc(firestore, 'admins', user.uid);
        
        try {
          const adminDocSnap = await getDoc(adminDocRef);

          if (!adminDocSnap.exists()) {
            await auth.signOut();
            toast({
              variant: 'destructive',
              title: 'Access Denied',
              description: 'You do not have admin privileges.',
            });
            return;
          }

          const adminData = adminDocSnap.data();
          toast({
            title: 'Admin Login Successful!',
            description: `Welcome back, ${adminData.displayName || 'Admin'}.`,
          });
          router.push('/dashboard/seller'); 

        } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: adminDocRef.path,
              operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
      })
      .catch((error: any) => {
        console.error('Admin Login Error:', error);
        let description = 'Could not sign you in. Please try again.';

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          description = 'Invalid email or password.';
        }
        
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: description,
        });
      });
  }

  // One-click login function
  const handleOneClickLogin = async () => {
    const adminEmail = 'admin@moneygod.com';
    const adminPassword = 'TemporaryPassword123!'; // Use a temporary, known password

    try {
        // Try to sign in first
        const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        toast({ title: 'Admin Login Successful!' });
        router.push('/dashboard/seller');
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            // If user does not exist, create it
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                const user = userCredential.user;
                
                // Also create the corresponding Firestore documents
                const batch = writeBatch(firestore);
                const userDocRef = doc(firestore, "userProfiles", user.uid);
                batch.set(userDocRef, {
                    id: user.uid,
                    fullName: "MoneyGo Admin",
                    username: "admin",
                    email: adminEmail,
                    joinDate: new Date().toISOString(),
                    userRole: "seller",
                });
                
                const adminDocRef = doc(firestore, 'admins', user.uid);
                batch.set(adminDocRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: "MoneyGo Admin",
                    role: 'SuperAdmin',
                    lastLogin: new Date().toISOString(),
                });

                await batch.commit();

                toast({
                    title: 'Admin Account Created & Logged In!',
                    description: 'Your admin account has been set up.',
                });
                router.push('/dashboard/seller');

            } catch (createError: any) {
                toast({ variant: 'destructive', title: 'Setup Failed', description: `Could not create admin account: ${createError.message}` });
            }
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            // This can happen if the user was created with a different password before.
            // For this special flow, we can't easily reset it without user interaction.
            toast({
                variant: 'destructive',
                title: 'Password Mismatch',
                description: 'An admin account exists but with a different password. Please contact support or clear the user from Firebase console.',
            });
        } else {
            toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
        }
    }
  };

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md border-primary/50">
          <CardHeader className="space-y-2 text-center">
             <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-full">
                    <KeyRound className="h-8 w-8 text-primary" />
                </div>
            </div>
            <CardTitle className="font-headline text-2xl">Admin Access</CardTitle>
            <CardDescription>Enter your admin credentials to continue.</CardDescription>
          </CardHeader>
          {!currentUser && (
            <div className="px-6 pb-4">
                <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={handleOneClickLogin}
                >
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    One-Click Admin Login (Temporary)
                </Button>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@moneygo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Authenticating...' : 'Secure Login'}
                </Button>
                
                <p className="text-sm text-center text-muted-foreground">
                    Not an admin? <Link href="/login" className="text-primary hover:underline">Go to regular login.</Link>
                </p>
                
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </AuthLayout>
  );
}

    