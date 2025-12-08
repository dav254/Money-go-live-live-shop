'use client';

import React from 'react';

export default function LiveProductBag({ products = [], onPin }) {
  return (
    <div className="p-3 bg-black/70 rounded">
      <h4 className="text-sm font-bold mb-2">Product Bag</h4>
      <div className="space-y-2 max-h-64 overflow-auto">
        {products.map(p => (
          <div key={p._id} className="flex items-center justify-between bg-zinc-800 p-2 rounded">
            <div className="flex items-center gap-3">
              <img src={p.images?.[0] || '/placeholder.png'} className="w-12 h-12 object-cover rounded" />
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-red-300">${p.priceUSD}</div>
              </div>
            </div>
            <div>
              <button onClick={() => onPin(p)} className="px-3 py-1 bg-red-600 rounded text-sm">Pin</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
