'use client';

import { Button } from "../ui/button";
import { useMemo } from "react";
import type { CartItem } from "@/lib/types";
import Image from "next/image";
import { Trash2 } from "lucide-react";

export function CartDrawer({ cartItems, onCheckout, onDeleteItem }: { cartItems: CartItem[], onCheckout: () => void, onDeleteItem: (productId: string) => void }) {
  const total = useMemo(() => {
    if (!cartItems) return 0;
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  return (
    <div className="w-full bg-neutral-900 p-3 flex flex-col h-full">
      <h3 className="font-bold border-b border-neutral-700 pb-2">🛒 Cart ({cartItems?.length || 0})</h3>
      
      <div className="flex-1 space-y-2 mt-2 overflow-y-auto">
        {cartItems && cartItems.length > 0 ? (
          cartItems.map((item) => (
            <div key={item.productId} className="text-sm flex items-center gap-2">
              <div className="relative h-8 w-8 rounded-sm overflow-hidden shrink-0">
                  <Image src={item.imageUrl || 'https://placehold.co/80x80/111111/ffffff?text=img'} alt={item.name} fill className="object-cover" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate">{item.name} x{item.quantity}</p>
                <p className="font-semibold text-primary">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteItem(item.productId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
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
        <Button onClick={onCheckout} disabled={!cartItems || cartItems.length === 0} className="bg-primary hover:bg-primary/90 w-full py-2 mt-3 rounded">
            Checkout
        </Button>
      </div>
    </div>
  );
}
