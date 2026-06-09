'use client';

import { useEffect } from 'react';
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
import { useAuth, useUser, useUserProfile } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export default function LoginPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

<<<<<<< HEAD
  // AUTO-LOGIN LOGIC: If already signed in, redirect instantly
=======
>>>>>>> 4f12c2ee803af08349669570d0b7ca812876038c
  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') {
        auth.signOut();
<<<<<<< HEAD
        toast({ variant: 'destructive', title: 'Access Denied', description: 'Your account is suspended.' });
=======
        toast({ variant: 'destructive', title: 'Account Suspended', description: 'Please contact support.' });
>>>>>>> 4f12c2ee803af08349669570d0b7ca812876038c
        return;
      }
      
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
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

<<<<<<< HEAD
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
=======
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: 'Authenticated', description: 'Checking profile...' });
>>>>>>> 4f12c2ee803af08349669570d0b7ca812876038c
    } catch (error: any) {
      console.error('Login Error:', error);
      let description = 'Incorrect email or password.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
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
<<<<<<< HEAD
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Authenticating Session</p>
=======
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
>>>>>>> 4f12c2ee803af08349669570d0b7ca812876038c
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
                <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={form.formState.isSubmitting}>
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
