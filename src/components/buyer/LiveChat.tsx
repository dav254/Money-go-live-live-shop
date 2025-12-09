
'use client';

import { Input } from "../ui/input";
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

interface LiveChatProps {
    liveSessionId: string | null;
}

const mockMessages = [
    { id: '1', senderId: 'user123', messageText: 'This looks amazing! 🔥' },
    { id: '2', senderId: 'user456', messageText: 'What is the price?' },
];

export function LiveChat({ liveSessionId }: LiveChatProps) {
    const [messages, setMessages] = useState(mockMessages);
    const [newMessage, setNewMessage] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const newMsg = {
            id: Date.now().toString(),
            senderId: 'Me',
            messageText: newMessage.trim(),
        };

        setMessages(prev => [...prev, newMsg]);
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
      
      <ScrollArea className="flex-1 space-y-2 text-sm overflow-y-auto" ref={scrollAreaRef}>
        {messages.map(message => (
             <p key={message.id}>
                <b className="text-neutral-400">{message.senderId}:</b> {message.messageText}
             </p>
        ))}
      </ScrollArea>

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

