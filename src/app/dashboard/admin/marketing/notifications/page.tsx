
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
import { Loader2, Megaphone, Send, Lightbulb } from 'lucide-react';
import { sendBulkNotifications } from '@/app/actions/notification-actions';

const notificationSchema = z.object({
  targetAudience: z.enum(['all', 'buyers', 'sellers', 'resellers']),
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
  link: z.string().url().optional().or(z.literal('')),
});

const notificationTemplates = [
    {
        title: "Flash Sale Announcement",
        message: "🔥 FLASH SALE! Get 25% off all electronics for the next 24 hours only. Don't miss out on these amazing deals!",
        audience: "all",
        link: "/sales/electronics"
    },
    {
        title: "New Feature: Reseller Program",
        message: "You can now earn by sharing products! Visit the new Reseller Hub to get started and see top-commission items.",
        audience: "all",
        link: "/dashboard/reseller"
    },
    {
        title: "Seller Tip of the Week",
        message: "Boost your sales by using our new AI Caption Generator! Create viral captions for your products and get noticed.",
        audience: "sellers",
        link: "/dashboard/seller/ai-tools"
    }
];

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
  
  const handleUseTemplate = (template: typeof notificationTemplates[0]) => {
      form.reset({
          targetAudience: template.audience as 'all' | 'buyers' | 'sellers' | 'resellers',
          title: template.title,
          message: template.message,
          link: template.link,
      });
      toast({ title: "Template Applied", description: "The form has been filled with the selected template." });
  }

  async function onSubmit(values: z.infer<typeof notificationSchema>) {
    setIsSending(true);
    try {
        const result = await sendBulkNotifications(values);
        if (result.success) {
            toast({
                title: 'Notifications Sent!',
                description: `${result.count || 0} notifications have been successfully queued for delivery.`,
            });
            form.reset();
        } else {
             throw new Error(result.error || 'An unknown error occurred.');
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Failed to Send',
            description: error.message || 'Could not send notifications. Please check the server logs.',
        });
    } finally {
        setIsSending(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card>
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
                                value={field.value}
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
            
            <Card className="sticky top-24">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lightbulb /> Notification Ideas</CardTitle>
                    <CardDescription>Click a template to get started.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {notificationTemplates.map((template, i) => (
                        <div key={i} className="rounded-lg border bg-card p-3">
                            <h4 className="font-semibold">{template.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{template.message}</p>
                            <Button size="sm" variant="secondary" className="mt-3" onClick={() => handleUseTemplate(template)}>Use Template</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
