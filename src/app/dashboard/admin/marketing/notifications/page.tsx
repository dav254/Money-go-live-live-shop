
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import { sendBulkNotifications } from '@/app/actions/notification-actions';

const formSchema = z.object({
  targetAudience: z.enum(['all', 'buyers', 'sellers', 'resellers']),
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
  link: z.string().optional(),
});

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [isSending, setIsSending] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetAudience: 'all',
      title: '',
      message: '',
      link: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSending(true);
    try {
        const result = await sendBulkNotifications(values);
        if (result.success) {
            toast({
                title: 'Notifications Sent!',
                description: `${result.count} notifications have been queued for delivery.`,
            });
            form.reset();
        } else {
            throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Failed to Send Notifications',
            description: error.message,
        });
    } finally {
        setIsSending(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Notification Center
        </h1>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Compose Notification</CardTitle>
            <CardDescription>
              Create and send a push notification to a group of users.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select who to send to" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="buyers">Buyers Only</SelectItem>
                          <SelectItem value="sellers">Sellers Only</SelectItem>
                          <SelectItem value="resellers">Resellers Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notification Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ✨ New Feature Alert!" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the update or promotion..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Optional Link</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., /products/new-item-id"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        When the user clicks the notification, they will be taken
                        to this page.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <Button type="submit" className="w-full" disabled={isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Notification
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
          </Form>
        </Card>
      </div>
    </AdminLayout>
  );
}
