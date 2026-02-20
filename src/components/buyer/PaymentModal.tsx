
'use client';

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function PaymentModal({ isOpen, onOpenChange }) {
    const [country, setCountry] = useState("");

    useEffect(() => {
        const fetchCountry = async () => {
            const response = await fetch('/api/location');
            const { country } = await response.json();
            setCountry(country);
        };

        fetchCountry();
    }, []);

    const handlePayment = async () => {
        const response = await fetch('/api/paystack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                amount: 1000, // TODO: Replace with actual amount
                email: 'test@example.com' // TODO: Replace with actual user email
            }),
        });

        const { authorization_url } = await response.json();

        if (authorization_url) {
            window.location.href = authorization_url;
        }
    };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white text-black p-5 rounded-lg w-80">
            <DialogHeader>
                <DialogTitle className="font-bold mb-3">💳 Pay Now</DialogTitle>
            </DialogHeader>
            
            {country === "Kenya" ? (
                <div className="space-y-4">
                    <Input placeholder="MPESA Number" className="border p-2 w-full mb-2" />
                </div>
            ) : (
                <div className="space-y-4">
                    <Input placeholder="Card Number" className="border p-2 w-full mb-2" />
                    <Input placeholder="MM/YY" className="border p-2 w-full mb-2" />
                    <Input placeholder="CVC" className="border p-2 w-full mb-2" />
                </div>
            )}

            <DialogFooter className="mt-4">
                <Button onClick={() => onOpenChange(false)} variant="ghost">Cancel</Button>
                {country === "Kenya" ? (
                    <Button className="bg-green-600 text-white w-full py-2 rounded">
                        Pay with M-Pesa
                    </Button>
                ) : (
                    <Button onClick={handlePayment} className="bg-blue-600 text-white w-full py-2 rounded">
                        Pay with Paystack
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
