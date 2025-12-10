
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";

export function PrivateChat({ sellerName }: { sellerName: string }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: "seller", text: "Welcome! Let me know if you have any questions." },
  ]);

  const [text, setText] = useState("");

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: "buyer",
      text,
    };

    setMessages([...messages, newMsg]);
    setText("");
  }

  return (
    <div className="bg-card text-card-foreground h-full w-full flex flex-col rounded-lg border">

      <div className="p-3 border-b text-center font-bold">
        Chat with {sellerName}
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
            {messages.map(msg => (
            <div
                key={msg.id}
                className={`flex ${msg.sender === "buyer" ? "justify-end" : "justify-start"}`}
            >
                <div
                    className={`p-2 rounded-lg max-w-[80%] text-sm ${
                    msg.sender === "buyer"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                >
                    {msg.text}
                </div>
            </div>
            ))}
        </div>
      </ScrollArea>

      <form onSubmit={sendMessage} className="flex p-3 gap-2 border-t">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message..."
          className="flex-1 rounded"
        />
        <Button
          type="submit"
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
