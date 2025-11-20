
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
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Please check your inbox (and spam folder) for instructions to reset your password.',
      });
      router.push('/login');
    } catch (error: any) {
      console.error('Password Reset Error:', error);
      let description = 'Could not send password reset email. Please try again.';
      if (error.code === 'auth/user-not-found') {
        description = 'No account found with this email address.';
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: description,
      });
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-full">
                    <KeyRound className="h-8 w-8 text-primary" />
                </div>
            </div>
            <CardTitle className="font-headline text-2xl">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a link to reset your password.
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Link href="/login" className="font-semibold text-primary hover:underline">
                    Back to Login
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
