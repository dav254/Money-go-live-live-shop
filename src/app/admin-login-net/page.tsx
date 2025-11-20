
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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';


const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function AdminLoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      
      const adminDocRef = doc(firestore, 'admins', user.uid);
      
      try {
        const adminDocSnap = await getDoc(adminDocRef);

        if (adminDocSnap.exists()) {
            toast({
            title: 'Admin Login Successful!',
            description: 'Welcome back, Admin.',
            });
            router.replace('/dashboard/admin');
        } else {
            await auth.signOut();
            toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: 'You do not have admin privileges.',
            });
        }
      } catch (firestoreError: any) {
        // This is the new error handling block.
        // It specifically catches Firestore errors (like permission denied)
        // that occur *after* a successful login.

        // Create the rich, contextual error.
        const permissionError = new FirestorePermissionError({
          path: adminDocRef.path,
          operation: 'get',
        });
        
        // Emit the error to be caught by the global error listener.
        errorEmitter.emit('permission-error', permissionError);

        // Also sign the user out as they cannot proceed.
        await auth.signOut();
      }

    } catch (error: any) {
      // This block handles Firebase Auth errors (e.g., wrong password)
      console.error('Admin Auth Error:', error);
      let description = 'Could not sign you in. Please try again.';

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'Invalid email or password.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: description,
      });
    }
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
            <CardDescription>
                First time admin? <Link href="/signup" className="text-primary hover:underline font-bold">Sign up here</Link> with the email <strong className="text-foreground">admin@goearn.com</strong> or <strong className="text-foreground">admin@moneygod.com</strong> to create your account.
            </CardDescription>
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
                        <Input type="email" placeholder="admin@goearn.com" {...field} />
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
