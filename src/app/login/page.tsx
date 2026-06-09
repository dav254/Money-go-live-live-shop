
'use client';

import { useEffect, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useAuth, useFirestore, useUser, useUserProfile } from '@/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // AUTO-LOGIN LOGIC: If already signed in, redirect instantly
  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') {
        auth.signOut();
        toast({ variant: 'destructive', title: 'Access Denied', description: 'Your account is suspended.' });
        return;
      }
      
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
      } else if (role === 'reseller') {
        router.replace('/dashboard/reseller');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else {
        router.replace('/buyer/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router, auth, toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;
      
      const userDocRef = doc(firestore, 'userProfiles', loggedUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Create default profile for first-time Google sign-ins via Login
        const profile = {
          id: loggedUser.uid,
          uid: loggedUser.uid,
          fullName: loggedUser.displayName || 'Google User',
          username: loggedUser.email?.split('@')[0] || `user_${loggedUser.uid.substring(0, 5)}`,
          email: loggedUser.email,
          profilePictureUrl: loggedUser.photoURL,
          joinDate: new Date().toISOString(),
          userRole: 'buyer',
          role: 'buyer',
          aiPoints: 0,
          status: 'active',
        };
        await setDoc(userDocRef, profile);
      }
      
      toast({ title: 'Login Successful!', description: "Welcome to GoEarn." });
    } catch (error: any) {
      console.error('Google Auth Error:', error);
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: 'Could not sign in with Google.',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const loggedUser = userCredential.user;

      const userDocRef = doc(firestore, 'userProfiles', loggedUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const profile = userDocSnap.data();
        
        if (profile.status === 'suspended') {
            await auth.signOut();
            toast({
                variant: 'destructive',
                title: 'Account Suspended',
                description: 'Your account has been suspended. Please contact support.',
            });
            return;
        }

        toast({ title: 'Login Successful!', description: "Welcome back to GoEarn." });
      }
    } catch (error: any) {
      console.error('Login Error:', error);
      let description = 'Incorrect email or password. Please check your details and try again.';
      
      if (error.code === 'auth/network-request-failed') {
        description = 'Network connection failed. Check your internet and try again.';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        description = 'The email or password you entered is incorrect.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: description,
      });
    }
  }

  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Authenticating Session</p>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md border-primary/20 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-headline text-2xl uppercase tracking-tighter">Welcome Back</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sign in to your GoEarn account</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button 
                variant="outline" 
                className="w-full h-12 font-bold flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || form.formState.isSubmitting}
            >
                {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                )}
                Continue with Google
            </Button>
            <div className="relative flex items-center justify-center">
                <Separator />
                <span className="absolute bg-background px-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">OR</span>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            className="text-xs font-medium text-primary hover:underline"
                            >
                            Forgot password?
                            </Link>
                        </div>
                        <FormControl>
                            <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={form.formState.isSubmitting || isGoogleLoading}>
                    {form.formState.isSubmitting ? 'Authenticating...' : 'Login'}
                </Button>
                </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}
