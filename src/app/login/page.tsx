
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
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function LoginPage() {
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

      // Fetch user profile from Firestore
      const userDocRef = doc(firestore, 'userProfiles', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userProfile = userDocSnap.data();
        
        // Check if the account is suspended
        if (userProfile.status === 'suspended') {
            await auth.signOut(); // Sign the user out immediately
            toast({
                variant: 'destructive',
                title: 'Account Suspended',
                description: 'Your account has been suspended. Please contact support.',
            });
            return;
        }

        toast({
            title: 'Login Successful!',
            description: "Welcome back.",
        });

        if (userProfile.userRole === 'seller') {
          router.push('/dashboard/seller');
        } else if (userProfile.userRole === 'reseller') {
          router.push('/dashboard/reseller');
        } else if (userProfile.userRole === 'admin') {
          router.push('/dashboard/admin');
        } else {
          router.push('/buyer/dashboard');
        }
      } else {
        console.warn("No user profile found for UID:", user.uid);
        router.push('/buyer/dashboard'); // Default redirect to buyer dashboard
      }

    } catch (error: any) {
      // Default error messages
      let title = 'Login Failed';
      let description = 'An unknown error occurred. Please try again.';

      // Check for specific auth errors to provide better user feedback
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        title = 'Invalid Credentials';
        description = 'The email or password you entered is incorrect. Please try again.';
      } else {
        // Log other, unexpected errors to the console for debugging
        console.error('Login Error:', error);
      }
      
      toast({
        variant: 'destructive',
        title: title,
        description: description,
      });
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-headline text-2xl">Welcome Back</CardTitle>
            <CardDescription>Enter your email below to login to your account</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="m@example.com" {...field} />
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
                       <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="/forgot-password"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Forgot your password?
                        </Link>
                      </div>
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
                  {form.formState.isSubmitting ? 'Logging in...' : 'Login'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="font-semibold text-primary hover:underline">
                    Sign up
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </AuthLayout>
  );
}
