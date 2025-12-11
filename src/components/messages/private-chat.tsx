
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";

// Mock message type for the demo
interface MockChatMessage {
    id: number;
    sender: 'buyer' | 'seller';
    text: string;
    timestamp: string;
}

export function PrivateChat({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<MockChatMessage[]>([
    { id: 1, sender: 'seller', text: `Hi! Welcome to my shop. Let me know if you have any questions about my products.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      // Scroll to bottom when new messages arrive
      if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [messages]);


  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const buyerMessage: MockChatMessage = {
        id: Date.now(),
        sender: 'buyer',
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    // Add buyer's message
    setMessages(prev => [...prev, buyerMessage]);
    setText("");

    // Simulate a seller reply after a short delay
    setTimeout(() => {
        const sellerReply: MockChatMessage = {
            id: Date.now() + 1,
            sender: 'seller',
            text: 'Thanks for your message! I will get back to you shortly.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, sellerReply]);
    }, 1000);
  }
  
  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  const EMOJIS = ['👍', '❤️', '🔥', '😂', '😍', '🙏'];


  return (
    <div className="bg-neutral-800 text-white h-full flex flex-col">
      <div className="p-3 border-b border-neutral-700 text-center font-bold flex-shrink-0">
        Chat with {sellerName}
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
        <div className="space-y-4">
            {messages?.map(msg => (
            <div
                key={msg.id}
                className={cn("flex flex-col gap-1", msg.sender === 'buyer' ? "items-end" : "items-start")}
            >
                <div
                    className={`p-2 rounded-lg max-w-[80%] text-sm ${
                    msg.sender === 'buyer'
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-neutral-700 rounded-bl-none"
                    }`}
                >
                    {msg.text}
                </div>
                 <p className="text-xs text-muted-foreground px-1">
                    {msg.timestamp}
                 </p>
            </div>
            ))}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="flex p-3 gap-2 border-t border-neutral-700 items-center flex-shrink-0">
         <Popover>
            <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="text-muted-foreground"><Smile /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
                <div className="flex gap-1">
                    {EMOJIS.map(emoji => (
                        <Button key={emoji} variant="ghost" size="icon" onClick={() => handleEmojiSelect(emoji)}>
                            {emoji}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message..."
          className="flex-1 rounded bg-neutral-900 border-neutral-600 p-2 text-white"
        />
        <Button
          type="submit"
          className="bg-primary px-4 py-2 rounded font-bold"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

    </div>
  );
}
