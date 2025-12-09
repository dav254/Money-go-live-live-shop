
'use client';

import { Input } from "../ui/input";

export function LiveChat() {
  return (
    <div className="w-2/3 p-3 flex flex-col overflow-y-auto bg-black border-r border-neutral-700">
      <p className="text-neutral-400 text-sm font-semibold mb-2">💬 Live Chat</p>

      <div className="flex-1 space-y-2 text-sm overflow-y-auto">
        <p><b className="text-neutral-400">Buyer1:</b> How much?</p>
        <p><b className="text-red-400">Seller:</b> $12 only</p>
        <p><b className="text-neutral-400">Buyer2:</b> Are they durable?</p>
        <p><b className="text-neutral-400">Buyer3:</b> I want size 42</p>
      </div>

      <input
        placeholder="Type message..."
        className="w-full mt-2 p-2 bg-neutral-800 rounded border-neutral-700"
      />
    </div>
  );
}
