import Link from 'next/link';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-auto text-primary" />
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <Toaster />
    </div>
  );
}
