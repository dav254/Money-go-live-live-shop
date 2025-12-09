
'use client';

import { Input } from "../ui/input";
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { ChatMessage } from "@/lib/types";
import { collection, query, orderBy } from "firebase/firestore";

interface LiveChatProps {
    liveSessionId: string | null;
}

export function LiveChat({ liveSessionId }: LiveChatProps) {
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');

    const messagesQuery = useMemoFirebase(() => {
        if (!liveSessionId || !firestore) {
            return null; // Return null if the session ID or firestore isn't ready
        }
        return query(
            collection(firestore, 'liveSessions', liveSessionId, 'chat'), 
            orderBy('timestamp', 'asc')
        );
    }, [firestore, liveSessionId]);

    const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);
    
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // The logic to send a message will be re-implemented when connecting the seller side.
        console.log("Sending message:", newMessage);
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
        {isLoading && <p className="text-center text-muted-foreground">Loading chat...</p>}
        {!isLoading && messages?.map((msg, i) => (
             <p key={i} className={`p-2 rounded w-fit ${
              msg.senderId === 'Me' // This will be replaced with actual user ID check
                ? "bg-blue-600 ml-auto"
                : "bg-gray-800"
            }`}>
                <b>{msg.senderId}:</b> {msg.messageText}
             </p>
        ))}
         {!isLoading && (!messages || messages.length === 0) && (
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
