
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import type { ChatMessage, Chat } from '@/lib/types';

export function PrivateChat({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [text, setText] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Effect to find the chat ID
  useEffect(() => {
    if (!user || !firestore || !sellerId) return;

    const findChat = async () => {
        const chatsRef = collection(firestore, 'chats');
        const q = query(
            chatsRef, 
            where('participantIds', 'array-contains', user.uid),
        );
        const querySnapshot = await getDocs(q);
        let existingChatId: string | null = null;
        querySnapshot.forEach(doc => {
            if (doc.data().participantIds.includes(sellerId)) {
                existingChatId = doc.id;
            }
        });
        setChatId(existingChatId);
    };

    findChat();
  }, [user, firestore, sellerId]);

  const messagesQuery = useMemoFirebase(() => {
    if (!chatId) return null;
    return query(collection(firestore, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chatId]);

  const { data: messages } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
      // Scroll to bottom when new messages arrive
      if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [messages]);


  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user || !firestore) return;

    let currentChatId = chatId;

    // If no chat exists, create one first
    if (!currentChatId) {
        const chatsRef = collection(firestore, 'chats');
        const newChatRef = doc(chatsRef);
        await setDoc(newChatRef, {
            id: newChatRef.id,
            participantIds: [user.uid, sellerId],
            lastMessage: text.trim(),
            lastMessageTimestamp: serverTimestamp(),
        });
        currentChatId = newChatRef.id;
        setChatId(currentChatId);
    }
    
    // Add the message to the chat
    const messagesRef = collection(firestore, 'chats', currentChatId, 'messages');
    await addDoc(messagesRef, {
        senderId: user.uid,
        messageText: text.trim(),
        timestamp: serverTimestamp()
    });

    setText("");
  }


  return (
    <div className="bg-neutral-800 text-white h-full flex flex-col rounded-lg">
      <div className="p-3 border-b border-neutral-700 text-center font-bold">
        Chat with {sellerName}
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
        <div className="space-y-4">
            {messages?.map(msg => (
            <div
                key={msg.id}
                className={`flex ${msg.senderId === user?.uid ? "justify-end" : "justify-start"}`}
            >
                <div
                    className={`p-2 rounded-lg max-w-[80%] text-sm ${
                    msg.senderId === user?.uid
                        ? "bg-primary text-primary-foreground"
                        : "bg-neutral-700"
                    }`}
                >
                    {msg.messageText}
                </div>
            </div>
            ))}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="flex p-3 gap-2 border-t border-neutral-700">
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
