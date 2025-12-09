
'use client';

import { Input } from "../ui/input";
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

interface LiveChatProps {
    liveSessionId: string | null;
}

export function LiveChat({ liveSessionId }: LiveChatProps) {
    const [messages, setMessages] = useState([
        { sender: "Seller", text: "Hello 👋" },
        { sender: "Me", text: "Is this available?" }
    ]);
    const [newMessage, setNewMessage] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setMessages(prev => [...prev, { sender: "Me", text: newMessage.trim() }]);
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
        {messages.map((msg, i) => (
             <p key={i} className={`p-2 rounded w-fit ${
              msg.sender === "Me"
                ? "bg-blue-600 ml-auto"
                : "bg-gray-800"
            }`}>
                <b>{msg.sender}:</b> {msg.text}
             </p>
        ))}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
        <Input
            placeholder="Type your message..."
            className="w-full p-2 bg-neutral-800 rounded border-neutral-700"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
        />
         <button
          onClick={() => {
            if (!newMessage) return;
            setMessages([...messages, { sender: "Me", text: newMessage }]);
            setNewMessage("");
          }}
          className="bg-red-600 px-4 rounded"
          type="button"
        >
          Send
        </button>
      </form>
    </div>
  );
}
