'use client';

import { useState } from "react";

export default function SellerChat() {
  const [messages, setMessages] = useState([
    { id: 1, sender: "buyer", name: "John", text: "Hello seller!" },
    { id: 2, sender: "buyer", name: "Mary", text: "Is this available?" },
    { id: 3, sender: "seller", name: "You", text: "Yes it's in stock!" }
  ]);

  const [text, setText] = useState("");

  function sendMessage() {
    if (!text.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: "seller",
      name: "You",
      text
    };

    setMessages([...messages, newMsg]);
    setText("");
  }

  return (
    <div className="bg-black text-white h-[500px] max-w-lg mx-auto flex flex-col rounded-lg">

      <div className="p-3 bg-gray-900 text-center font-bold">
        Seller Live Chat (All Buyers)
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-2 rounded-lg max-w-[80%] ${
              msg.sender === "seller"
                ? "bg-blue-600 self-end ml-auto"
                : "bg-gray-800 self-start"
            }`}
          >
            <p className="text-xs text-gray-400">{msg.name}</p>
            {msg.text}
          </div>
        ))}
      </div>

      <div className="flex p-3 gap-2 bg-gray-900">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply to buyers..."
          className="flex-1 rounded bg-gray-800 p-2 text-white"
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 px-4 py-2 rounded font-bold"
        >
          Reply
        </button>
      </div>

    </div>
  );
}