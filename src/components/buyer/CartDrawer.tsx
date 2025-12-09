
'use client';

import { Button } from "../ui/button";
import { useMemo } from "react";

export function CartDrawer({ cartItems, onCheckout }) {
  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price, 0);
  }, [cartItems]);

  return (
    <div className="w-1/3 bg-neutral-900 p-3 flex flex-col">
      <h3 className="font-bold border-b border-neutral-700 pb-2">🛒 Cart ({cartItems.length})</h3>
      
      <div className="flex-1 space-y-2 mt-2 overflow-y-auto">
        {cartItems.length > 0 ? (
          cartItems.map((item, index) => (
            <div key={index} className="text-sm flex justify-between">
              <span>{item.name}</span>
              <span className="font-semibold">${item.price}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-neutral-500 text-center pt-8">Your cart is empty.</p>
        )}
      </div>

      <div className="mt-auto pt-2 border-t border-neutral-700">
        <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
        </div>
        <Button onClick={onCheckout} disabled={cartItems.length === 0} className="bg-green-600 hover:bg-green-700 w-full py-2 mt-3 rounded">
            Checkout
        </Button>
      </div>
    </div>
  );
}
