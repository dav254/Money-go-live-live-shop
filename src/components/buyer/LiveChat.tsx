
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';

interface LiveChatProps {
  streamId: string;
}

export function LiveChat({ streamId }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();

  // This would be replaced with actual user data
  const currentUser = { id: 'Me', name: 'You' }; 

  const messagesQuery = React.useMemo(() => {
    if (!firestore || !streamId) return null;
    return query(collection(firestore, `livestreams/${streamId}/chat`), orderBy('timestamp', 'asc'));
  }, [firestore, streamId]);

  const { data: messagesSnapshot } = useCollection(messagesQuery);

  const messages = React.useMemo(() => {
      return messagesSnapshot?.docs.map(doc => doc.data() as ChatMessage) || [];
  }, [messagesSnapshot]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !streamId) return;

    await addDoc(collection(firestore, `livestreams/${streamId}/chat`), {
      senderId: currentUser.id,
      senderName: currentUser.name,
      messageText: newMessage.trim(),
      timestamp: serverTimestamp(),
    });
    setNewMessage('');
  };

  return (
      <div className="flex flex-col h-[calc(100vh-theme(space.16))] bg-black border-r border-neutral-700">
        <div className="p-3 border-b border-neutral-700">
            <p className="text-neutral-400 text-sm font-semibold">💬 Live Chat</p>
        </div>
        
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="space-y-3 p-3">
              {messages.map((msg, i) => (
                  <div
                      key={i}
                      className={`p-2 rounded-lg w-fit text-sm text-white ${
                      msg.senderId === "Me"
                          ? "bg-blue-600 ml-auto"
                          : "bg-neutral-800"
                      }`}
                  >
                      <span className="font-bold mr-1">{msg.senderName || msg.senderId}:</span>{msg.messageText}
                  </div>
              ))}
              {!messages || messages.length === 0 && (
                  <p className="text-center text-muted-foreground pt-8">No messages yet.</p>
              )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-neutral-700">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Say something..."
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg"
                />
                <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700 flex-shrink-0">
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
      </div>
  );
}
