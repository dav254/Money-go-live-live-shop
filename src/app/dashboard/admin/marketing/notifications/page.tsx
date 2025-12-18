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
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Megaphone, Send } from 'lucide-react';

const notificationSchema = z.object({
  targetAudience: z.enum(['all', 'buyers', 'sellers', 'resellers']),
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
  link: z.string().url().optional().or(z.literal('')),
});

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [isSending, setIsSending] = React.useState(false);

  const form = useForm<z.infer<typeof notificationSchema>>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      targetAudience: 'all',
      title: '',
      message: '',
      link: '',
    },
  });

  function onSubmit(values: z.infer<typeof notificationSchema>) {
    setIsSending(true);
    toast({
      title: 'Simulating Send...',
      description: `Sending notification to ${values.targetAudience} users.`,
    });

    // Simulate a network request
    setTimeout(() => {
      setIsSending(false);
      toast({
        title: 'Notification Sent!',
        description: 'The notification has been queued for delivery.',
      });
      form.reset();
    }, 1500);
  }

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                  <Megaphone className="text-primary" />
                  Create a New Notification
                </CardTitle>
                <CardDescription>
                  Send a platform-wide announcement to a specific group of users.
                </CardDescription>
              </CardHeader>
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
                            <SelectValue placeholder="Select who will receive this notification" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="buyers">Buyers Only</SelectItem>
                          <SelectItem value="sellers">Sellers Only</SelectItem>
                          <SelectItem value="resellers">
                            Resellers Only
                          </SelectItem>
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
                        <Input
                          placeholder="e.g., Upcoming Maintenance"
                          {...field}
                        />
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
                      <FormLabel>Message Body</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Write the main content of your notification here."
                          rows={5}
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
                      <FormLabel>Action Link (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., https://yourapp.com/new-features"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        When the user clicks the notification, they will be taken
                        to this URL.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSending} className="ml-auto">
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send Notification
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}