
'use client';

import { Input } from "../ui/input";
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import type { ChatMessage } from "@/lib/types";

interface LiveChatProps {
    liveSessionId: string | null;
}

export function LiveChat({ liveSessionId }: LiveChatProps) {
    const [newMessage, setNewMessage] = useState('');
    const [messages, setMessages] = useState<Partial<ChatMessage>[]>([
        { senderId: 'user123', messageText: 'This looks amazing! 🔥'},
        { senderId: 'user456', messageText: 'What is the price?'}
    ]);
    
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const myMessage: Partial<ChatMessage> = {
            senderId: 'Me', // This will be replaced with actual user ID later
            messageText: newMessage,
        }
        setMessages(prev => [...prev, myMessage]);
        setNewMessage('');
    };

    useEffect(() => {
        if(scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [messages]);

  return (
    <div className="w-2/3 p-3 flex flex-col overflow-y-auto bg-black border-r border-neutral-700">
      <p className="text-neutral-400 text-sm font-semibold mb-2">💬 Live Chat</p>
      
      <ScrollArea className="flex-1 space-y-2 text-sm overflow-y-auto bg-neutral-900/50 p-2 rounded-md" ref={scrollAreaRef}>
        {messages.map((msg, i) => (
             <p key={i} className={`p-2 rounded w-fit ${
              msg.senderId === 'Me'
                ? "bg-blue-600 ml-auto"
                : "bg-gray-800"
            }`}>
                <b>{msg.senderId}:</b> {msg.messageText}
             </p>
        ))}
         {!messages || messages.length === 0 && (
            <p className="text-center text-muted-foreground pt-8">No messages yet.</p>
         )}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
        <Input
            placeholder="Type your message..."
            className="w-full p-2 bg-neutral-800 rounded border-neutral-700"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
        />
         <button
          className="bg-red-600 px-4 rounded"
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  );
}
