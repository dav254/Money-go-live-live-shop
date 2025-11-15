
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
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function AdminLoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleDeleteAccount = async () => {
    if (currentUser && currentUser.email === 'admin@moneygo.com') {
      try {
        const batch = writeBatch(firestore);
        
        // Firestore documents to delete
        const userProfileRef = doc(firestore, 'userProfiles', currentUser.uid);
        const adminRef = doc(firestore, 'admins', currentUser.uid);
        
        batch.delete(userProfileRef);
        batch.delete(adminRef);

        await batch.commit();
        
        // Then delete the auth user
        await deleteUser(currentUser);
        
        toast({
          title: 'Account Deleted',
          description: 'You can now sign up again with the same email.',
        });
        // A full page reload is better here to ensure all state is cleared
        window.location.href = '/signup';
      } catch (error: any) {
         toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: error.message || 'Could not delete account. Please try logging in again to re-authenticate before deleting.',
        });
        console.error("Deletion error:", error);
      }
    } else {
        toast({
            variant: 'destructive',
            title: 'Not Logged In',
            description: 'You must be logged in as the admin user to perform this action.',
        });
    }
  };

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
          router.push('/dashboard/seller'); // Redirect to a default admin dashboard later

        } catch (error) {
           // This catch block specifically handles the getDoc permission error
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
            <CardDescription>This area is restricted to authorized personnel only.</CardDescription>
          </CardHeader>
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
                        <Input type="password" {...field} />
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
                 {currentUser && currentUser.email === 'admin@moneygo.com' && (
                  <Button variant="link" className="text-destructive" onClick={handleDeleteAccount} type="button">
                    Account issue? Delete and re-register admin.
                  </Button>
                )}
                 {!currentUser && (
                    <p className="text-sm text-center text-muted-foreground">
                        Forgot password? <Link href="/signup" className="text-primary hover:underline">Re-register here.</Link>
                    </p>
                )}
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </AuthLayout>
  );
}
