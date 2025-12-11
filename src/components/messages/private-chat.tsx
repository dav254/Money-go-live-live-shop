
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import type { ChatMessage, Chat, UserProfile } from "@/lib/types";

export function PrivateChat({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [text, setText] = useState("");
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Find existing chat or prepare to create a new one
  useEffect(() => {
    if (!user || !sellerId) return;

    const chatsRef = collection(firestore, "chats");
    const q = query(
      chatsRef,
      where("participantIds", "array-contains", user.uid)
    );

    getDocs(q).then((querySnapshot) => {
      const existingChat = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Chat))
        .find(chat => chat.participantIds.includes(sellerId));
      
      if (existingChat) {
        setActiveChat(existingChat);
      }
    });
  }, [user, sellerId, firestore]);

  // Fetch messages for the active chat
  const messagesQuery = useMemoFirebase(() => {
    if (!activeChat) return null;
    return query(collection(firestore, 'chats', activeChat.id, 'messages'), orderBy('timestamp', 'asc'));
  }, [activeChat, firestore]);
  const { data: messages } = useCollection<ChatMessage>(messagesQuery);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
      if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || isSending) return;

    setIsSending(true);

    let currentChatId = activeChat?.id;

    try {
        // If no chat exists, create one first
        if (!currentChatId) {
            const newChatRef = doc(collection(firestore, "chats"));
            const newChat: Chat = {
                id: newChatRef.id,
                participantIds: [user.uid, sellerId],
                lastMessage: text.trim(),
                lastMessageTimestamp: serverTimestamp(),
            };
            await setDoc(newChatRef, newChat);
            setActiveChat(newChat); // Set the newly created chat as active
            currentChatId = newChat.id;
        }

        if (!currentChatId) {
            throw new Error("Failed to create or find chat session.");
        }

        // Add the message to the messages subcollection
        const messagesRef = collection(firestore, 'chats', currentChatId, 'messages');
        await addDoc(messagesRef, {
            senderId: user.uid,
            messageText: text.trim(),
            timestamp: serverTimestamp(),
        });
        
        // Update the last message on the chat document (if it's not a new chat)
        if (activeChat) {
            const chatRef = doc(firestore, 'chats', currentChatId);
            await updateDoc(chatRef, {
                lastMessage: text.trim(),
                lastMessageTimestamp: serverTimestamp(),
            });
        }

        setText("");

    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        setIsSending(false);
    }
  };
  
  return (
    <div className="bg-neutral-800 text-white flex flex-col h-full">
      <div className="p-3 border-b border-neutral-700 text-center font-bold flex-shrink-0">
        Chat with {sellerName}
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
        <div className="space-y-4">
            {messages?.map(msg => (
            <div
                key={msg.id}
                className={cn("flex flex-col gap-1", msg.senderId === user?.uid ? "items-end" : "items-start")}
            >
                <div
                    className={`p-2 rounded-lg max-w-[80%] text-sm ${
                    msg.senderId === user?.uid
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-neutral-700 rounded-bl-none"
                    }`}
                >
                    {msg.messageText}
                </div>
                 <p className="text-xs text-muted-foreground px-1">
                    {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </p>
            </div>
            ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="flex p-3 gap-2 border-t border-neutral-700 items-center flex-shrink-0">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message..."
          className="flex-1 rounded bg-neutral-900 border-neutral-600 p-2 text-white"
          disabled={!user}
        />
        <Button
          type="submit"
          className="bg-primary px-4 py-2 rounded font-bold"
          disabled={!user || !text.trim() || isSending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

    </div>
  );
}
