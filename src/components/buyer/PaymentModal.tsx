
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function PaymentModal({ isOpen, onOpenChange }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white text-black p-5 rounded-lg w-80">
            <DialogHeader>
                <DialogTitle className="font-bold mb-3">💳 Pay Now</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
                <Input placeholder="Card / MPESA Number" className="border p-2 w-full mb-2" />
                <Input placeholder="MM/YY" className="border p-2 w-full mb-2" />
                <Input placeholder="CVC" className="border p-2 w-full mb-2" />
            </div>

            <DialogFooter className="mt-4">
                <Button onClick={() => onOpenChange(false)} variant="ghost">Cancel</Button>
                <Button className="bg-blue-600 text-white w-full py-2 rounded">
                    Pay Now
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
