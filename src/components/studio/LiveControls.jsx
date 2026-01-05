
'use client';

import React from 'react';

export default function LiveControls({ onGoLive, onEndLive, onAddProduct }) {
  return (
    <div className="p-3 bg-black/80 border border-red-800 rounded">
      <div className="flex gap-2">
        <button onClick={onGoLive} className="px-4 py-2 bg-red-600 rounded">Go Live</button>
        <button onClick={onEndLive} className="px-4 py-2 bg-gray-700 rounded">End Live</button>
        <button onClick={onAddProduct} className="px-4 py-2 bg-zinc-800 rounded">Add Product</button>
      </div>
    </div>
  );
}
