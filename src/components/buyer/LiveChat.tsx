
'use client';

import { Input } from "../ui/input";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import type { ChatMessage } from "@/lib/types";
import { useState } from "react";
import { Button } from "../ui/button";
import { Send } from "lucide-react";

interface LiveChatProps {
    liveSessionId: string | null;
}

export function LiveChat({ liveSessionId }: LiveChatProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');

    const messagesQuery = useMemoFirebase(() => {
        if (!liveSessionId) return null;
        return query(collection(firestore, 'liveSessions', liveSessionId, 'chat'), orderBy('timestamp', 'asc'));
    }, [firestore, liveSessionId]);

    const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !liveSessionId) return;

        const chatCollectionRef = collection(firestore, 'liveSessions', liveSessionId, 'chat');
        await addDoc(chatCollectionRef, {
            senderId: user.uid,
            messageText: newMessage.trim(),
            timestamp: serverTimestamp()
        });
        setNewMessage('');
    };

  return (
    <div className="w-2/3 p-3 flex flex-col overflow-y-auto bg-black border-r border-neutral-700">
      <p className="text-neutral-400 text-sm font-semibold mb-2">💬 Live Chat</p>

      <div className="flex-1 space-y-2 text-sm overflow-y-auto">
        {isLoading && <p className="text-sm text-neutral-500">Loading chat...</p>}
        {messages?.map(message => (
             <p key={message.id}>
                <b className="text-neutral-400">{message.senderId.substring(0, 6)}:</b> {message.messageText}
             </p>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
        <Input
            placeholder="Type message..."
            className="w-full p-2 bg-neutral-800 rounded border-neutral-700"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
        />
         <Button type="submit" size="icon"><Send className="h-4 w-4"/></Button>
      </form>
    </div>
  );
}
