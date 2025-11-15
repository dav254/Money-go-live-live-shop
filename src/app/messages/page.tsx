
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Archive,
  CircleDashed,
  File,
  Image as ImageIcon,
  Link,
  Mic,
  MoreVertical,
  Package,
  Phone,
  Search,
  Send,
  Video,
} from 'lucide-react';
import React, { useState } from 'react';

const conversations = [
  {
    id: 1,
    name: 'Ann Wanjiru',
    avatar: 'https://picsum.photos/seed/user1/40/40',
    lastMessage: 'Can you deliver to Nairobi CBD?',
    time: '2:45 PM',
    unread: 2,
    order: { id: '1234', status: 'Pending' },
  },
  {
    id: 2,
    name: 'David Otieno',
    avatar: 'https://picsum.photos/seed/user2/40/40',
    lastMessage: 'Okay, thank you for the info!',
    time: 'Yesterday',
    unread: 0,
  },
  {
    id: 3,
    name: 'Grace Mwende',
    avatar: 'https://picsum.photos/seed/user3/40/40',
    lastMessage: 'You: Yes, it is still available.',
    time: '3 days ago',
    unread: 0,
    order: { id: '1229', status: 'Delivered' },
  },
    {
    id: 4,
    name: 'Peter Kamau',
    avatar: 'https://picsum.photos/seed/user4/40/40',
    lastMessage: '[Image]',
    time: '3 days ago',
    unread: 0,
  },
];

const messages = [
    { id: 1, sender: 'Ann Wanjiru', type: 'text', content: 'Hi, I saw the classic leather handbag on your shop.', time: '2:40 PM' },
    { id: 2, sender: 'me', type: 'text', content: 'Hello Ann! Thank you for your interest. Yes, it is a very popular item.', time: '2:41 PM' },
    { id: 3, sender: 'Ann Wanjiru', type: 'text', content: 'It looks beautiful. Is it genuine leather?', time: '2:42 PM' },
    { id: 4, sender: 'me', type: 'product', content: 'Yes, 100% genuine leather, handcrafted. Here is the product again for details.', time: '2:43 PM' },
    { id: 5, sender: 'Ann Wanjiru', type: 'text', content: 'Perfect! I want to buy it. Can you deliver to Nairobi CBD?', time: '2:45 PM' },
];

const ProductCard = () => (
     <div className="max-w-xs rounded-lg border bg-background p-3 shadow-sm">
        <div className="flex gap-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                <Avatar className="h-full w-full rounded-none">
                     <AvatarImage src="https://picsum.photos/seed/handbag/150/150" alt="product" />
                </Avatar>
            </div>
            <div>
                <p className="font-semibold">Classic Leather Handbag</p>
                <p className="text-sm font-bold text-primary">KES 850</p>
                <Button size="sm" className="mt-1 h-7">View Product</Button>
            </div>
        </div>
    </div>
)


export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);

  return (
    <BuyerLayout>
      <div className="flex h-[calc(100vh-4rem)] border-t">
        {/* Left Side: Conversation List */}
        <div className="hidden h-full w-full max-w-xs flex-col border-r bg-muted/20 md:flex">
          <div className="flex items-center gap-2 border-b p-3">
            <h2 className="font-headline text-xl font-bold">Messages</h2>
            <Badge>{conversations.length}</Badge>
          </div>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search messages..." className="pl-9" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConversation(convo)}
                  className={cn(
                    'flex items-start gap-3 p-3 text-left transition-colors hover:bg-accent',
                    selectedConversation.id === convo.id && 'bg-accent'
                  )}
                >
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={convo.avatar} alt={convo.name} />
                    <AvatarFallback>{convo.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{convo.name}</p>
                      <p className="text-xs text-muted-foreground">{convo.time}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm text-muted-foreground pr-4">{convo.lastMessage}</p>
                      {convo.unread > 0 && (
                        <Badge className="flex h-5 w-5 items-center justify-center p-0">{convo.unread}</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Chat Window */}
        <div className="flex h-full flex-1 flex-col">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border">
                <AvatarImage src={selectedConversation.avatar} alt={selectedConversation.name} />
                <AvatarFallback>{selectedConversation.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedConversation.name}</p>
                <p className="text-sm text-muted-foreground">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon"><Package className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
                 <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 bg-muted/10">
            <div className="p-4 space-y-6">
               {messages.map((msg) => (
                   <div key={msg.id} className={cn("flex", msg.sender === 'me' ? "justify-end" : "justify-start")}>
                       <div className={cn("flex max-w-sm flex-col gap-1", msg.sender === 'me' ? "items-end" : "items-start")}>
                           <div className={cn(
                               "rounded-xl p-3 text-sm shadow-sm",
                               msg.sender === 'me' 
                                ? "bg-primary text-primary-foreground rounded-br-none" 
                                : "bg-card border rounded-bl-none"
                            )}>
                                {msg.type === 'product' ? <ProductCard /> : <p>{msg.content}</p>}
                           </div>
                           <span className="text-xs text-muted-foreground">{msg.time}</span>
                       </div>
                   </div>
               ))}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t bg-background p-3">
            <div className="relative">
                <Input placeholder="Type your message..." className="pr-24" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    <Button variant="ghost" size="icon"><Link className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon"><Mic className="h-5 w-5" /></Button>
                    <Button size="sm">Send</Button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
