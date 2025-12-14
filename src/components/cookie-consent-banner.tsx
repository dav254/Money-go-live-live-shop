'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cookie } from 'lucide-react';
import Link from 'next/link';

// Function to set a cookie
function setCookie(name: string, value: string, days: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  if (typeof document !== 'undefined') {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
}

// Function to get a cookie
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run on the client side
    if (typeof window !== 'undefined') {
      const consent = getCookie('cookie_consent');
      if (!consent) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleAccept = () => {
    setCookie('cookie_consent', 'true', 365);
    setIsVisible(false);
  };

  const handleDecline = () => {
    // You can set it to false if you want to track declined users,
    // or just not set it and the banner will appear again next session.
    setCookie('cookie_consent', 'false', 365);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="container mx-auto max-w-lg p-4 bg-background/80 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Cookie className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">We Use Cookies</h3>
            <p className="text-sm text-muted-foreground">
              Our website uses cookies to enhance your browsing experience and analyze site traffic. By clicking "Accept", you agree to our use of cookies.
              Learn more in our <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
            </p>
          </div>
          <div className="flex gap-2 self-end sm:self-center">
            <Button variant="outline" size="sm" onClick={handleDecline}>Decline</Button>
            <Button size="sm" onClick={handleAccept}>Accept</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
