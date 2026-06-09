
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useAuth, useUser, useUserProfile, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  username: z.string().min(2, { message: 'Username must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['buyer', 'seller'], { required_error: 'You must select a role.' }),
});

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // AUTO-LOGIN LOGIC: Redirect if already logged in
  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') return;
      
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else if (role === 'reseller') {
        router.replace('/dashboard/reseller');
      } else {
        router.replace('/buyer/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'buyer',
    },
  });

  async function handleGoogleSignup() {
    const selectedRole = form.getValues('role');
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedUpUser = result.user;

      const userDocRef = doc(firestore, "userProfiles", signedUpUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const profile = {
          id: signedUpUser.uid,
          uid: signedUpUser.uid,
          fullName: signedUpUser.displayName || 'Google User',
          username: signedUpUser.email?.split('@')[0] || `user_${signedUpUser.uid.substring(0, 5)}`,
          email: signedUpUser.email,
          profilePictureUrl: signedUpUser.photoURL,
          joinDate: new Date().toISOString(),
          userRole: selectedRole,
          role: selectedRole,
          aiPoints: selectedRole === 'seller' ? 1000 : 0, 
          status: 'active',
          ...(selectedRole === 'seller' && { freePointsAwardedAt: new Date().toISOString() })
        };

        await setDoc(userDocRef, profile);
        toast({ 
          title: selectedRole === 'seller' ? 'Welcome Bonus Awarded! 🎁' : 'Account Created!', 
          description: selectedRole === 'seller' ? "Welcome! You've received 1000 free AI points." : "You've successfully joined GoEarnvid.shop" 
        });
      } else {
        toast({ title: 'Welcome Back!', description: "Signing you in with your existing account." });
      }
    } catch (error: any) {
      console.error('Google Signup Error:', error);
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: 'Could not sign up with Google.',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const signedUpUser = userCredential.user;

      const userDocRef = doc(firestore, "userProfiles", signedUpUser.uid);
      
      const profile = {
        id: signedUpUser.uid,
        uid: signedUpUser.uid,
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        joinDate: new Date().toISOString(),
        userRole: values.role,
        role: values.role,
        aiPoints: values.role === 'seller' ? 1000 : 0, 
        status: 'active',
        ...(values.role === 'seller' && { freePointsAwardedAt: new Date().toISOString() })
      };

      await setDoc(userDocRef, profile);
      toast({ 
        title: values.role === 'seller' ? 'Welcome Bonus Awarded! 🎁' : 'Account Created!', 
        description: values.role === 'seller' ? "Welcome to GoEarnvid! You've received 1000 free AI points." : "You've successfully joined GoEarnvid.shop" 
      });

    } catch (error: any) {
      console.error('Signup Error:', error);
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: error.message || 'Could not create your account.',
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
            <CardTitle className="font-headline text-2xl uppercase tracking-tighter">Create Account</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Join the future of social commerce at GoEarnvid</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
             <Form {...form}>
                <form className="space-y-4">
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>I am a...</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger className="h-12 border-primary/20">
                                <SelectValue placeholder="Select your role" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="buyer">Buyer (I want to shop)</SelectItem>
                            <SelectItem value="seller">Seller (I want to sell)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                </form>
            </Form>
            <Button 
                variant="outline" 
                className="w-full h-12 font-bold flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5"
                onClick={handleGoogleSignup}
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
                Signup with Google
            </Button>
            <div className="relative flex items-center justify-center">
                <Separator />
                <span className="absolute bg-background px-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">OR USE EMAIL</span>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                            <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                            <Input placeholder="johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={form.formState.isSubmitting || isGoogleLoading}>
                  {form.formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}
