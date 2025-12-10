'use client';

import { useState } from "react";

export default function BuyerChat() {
  const [messages, setMessages] = useState([
    { id: 1, sender: "seller", text: "Welcome to my live shop!" },
    { id: 2, sender: "buyer", text: "Hi, how much is this?" }
  ]);

  const [text, setText] = useState("");

  function sendMessage() {
    if (!text.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: "buyer",
      text
    };

    setMessages([...messages, newMsg]);
    setText("");
  }

  return (
    <div className="bg-black text-white h-[500px] max-w-md mx-auto flex flex-col rounded-lg">

      <div className="p-3 bg-gray-900 text-center font-bold">
        Chat with Seller
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-2 rounded-lg max-w-[80%] ${
              msg.sender === "buyer"
                ? "bg-green-600 self-end ml-auto"
                : "bg-gray-800 self-start"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="flex p-3 gap-2 bg-gray-900">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message..."
          className="flex-1 rounded bg-gray-800 p-2 text-white"
        />
        <button
          onClick={sendMessage}
          className="bg-green-600 px-4 py-2 rounded font-bold"
        >
          Send
        </button>
      </div>

    </div>
  );
}