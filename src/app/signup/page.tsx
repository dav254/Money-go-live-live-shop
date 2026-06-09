'use client';

import { useEffect, Suspense } from 'react';
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
import Link from 'next/link';
import { useAuth, useUser, useUserProfile, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, Sparkles } from 'lucide-react';

const formSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  username: z.string().min(2, { message: 'Username must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['buyer', 'seller'], { required_error: 'You must select a role.' }),
});

function SignupFormContent() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const defaultRole = (searchParams.get('role') as 'buyer' | 'seller') || 'buyer';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: defaultRole,
    },
  });

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') return;
      
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else {
        router.replace('/buyer/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

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
    <Card className="w-full max-w-md border-primary/20 shadow-2xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="font-headline text-2xl uppercase tracking-tighter">Create Account</CardTitle>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Join the future of social commerce</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary">I want to join as a...</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger className="h-14 border-primary/30 bg-primary/5 rounded-xl font-bold">
                            <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="buyer" className="font-medium">Buyer (Discover & Shop)</SelectItem>
                        <SelectItem value="seller" className="font-medium">Seller (Post & Earn Revenue)</SelectItem>
                        </SelectContent>
                    </Select>
                    {form.watch('role') === 'seller' && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 animate-in fade-in zoom-in-95">
                            <Sparkles className="h-3 w-3 text-green-500" />
                            <p className="text-[9px] font-black text-green-500 uppercase tracking-widest">Founding Seller: +1,000 Free Points included</p>
                        </div>
                    )}
                    <FormMessage />
                    </FormItem>
                )}
              />
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
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={form.formState.isSubmitting}>
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
  );
}

export default function SignupPage() {
  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-12 px-4">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        }>
          <SignupFormContent />
        </Suspense>
      </div>
    </AuthLayout>
  );
}
