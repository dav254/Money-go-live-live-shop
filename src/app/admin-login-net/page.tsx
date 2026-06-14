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
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
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
      
      const userProfileRef = doc(firestore, 'userProfiles', user.uid);
      
      try {
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists() && userProfileSnap.data().userRole === 'admin') {
            toast({
              title: 'Admin Session Started',
              description: 'Redirecting to control room...',
            });
            router.replace('/dashboard/admin');
        } else {
            await signOut(auth);
            toast({
              variant: 'destructive',
              title: 'Invalid Access',
              description: 'The provided account does not have admin clearance.',
            });
        }
      } catch (firestoreError: any) {
        // Graceful exit for role verification failures
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: 'Invalid admin credentials or session error.',
        });
      }

    } catch (error: any) {
      // Simplified auth errors
      let description = 'Invalid email or password.';
      
      if (error.code === 'auth/too-many-requests') {
        description = 'Too many failed attempts. Please try again later.';
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
      <div className="flex items-center justify-center py-12 px-4 w-full">
        <Card className="w-full max-w-md border-primary/50 shadow-2xl bg-card/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader className="space-y-2 text-center bg-white/5 border-b border-white/5 p-8">
             <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                    <KeyRound className="h-8 w-8 text-primary" />
                </div>
            </div>
            <CardTitle className="font-headline text-2xl uppercase tracking-tighter text-white">Admin Access</CardTitle>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Secure Gateway Protocol • Phase 2 Verified
            </CardDescription>
          </CardHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="grid gap-6 p-8">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Admin Identifier</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@goearnvid.shop" className="h-12 bg-black/40 border-white/5 rounded-xl px-4" {...field} />
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
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Security Token</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" className="h-12 bg-black/40 border-white/5 rounded-xl px-4" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col gap-4 p-8 pt-0">
                <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</>
                  ) : 'Initialize Session'}
                </Button>
                
                <p className="text-[10px] font-bold text-center text-neutral-600 uppercase tracking-widest">
                    Unauthorized access attempts are logged and tracked.
                </p>
                
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </AuthLayout>
  );
}
