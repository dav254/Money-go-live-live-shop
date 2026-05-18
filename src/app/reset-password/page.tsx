'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { useAuth } from '@/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

function ResetPasswordForm() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [isVerifying, setIsVerifying] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setError('Invalid or missing password reset code.');
      setIsVerifying(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setIsVerifying(false);
      })
      .catch((err) => {
        console.error('Verification error:', err);
        setError('The password reset link is invalid or has expired.');
        setIsVerifying(false);
      });
  }, [auth, oobCode]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!oobCode) return;

    try {
      await confirmPasswordReset(auth, oobCode, values.password);
      setSuccess(true);
      toast({
        title: 'Password Updated!',
        description: 'You can now log in with your new password.',
      });
    } catch (error: any) {
      console.error('Reset Error:', error);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error.message || 'Could not reset password. Please try again.',
      });
    }
  }

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium uppercase tracking-widest opacity-50">Verifying Security Token...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md border-destructive/20">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
            </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Token Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request New Link</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md border-green-500/20">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
            </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tighter">Success!</CardTitle>
          <CardDescription>Your password has been changed successfully.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full h-12 font-black uppercase tracking-widest">
            <Link href="/login">Continue to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
                <KeyRound className="h-8 w-8 text-primary" />
            </div>
        </div>
        <CardTitle className="font-headline text-2xl uppercase tracking-tighter">New Password</CardTitle>
        <CardDescription>
          Resetting password for <span className="font-bold text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Min. 6 characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Repeat new password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-12 px-4">
        <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </AuthLayout>
  );
}