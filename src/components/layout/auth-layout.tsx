import Link from 'next/link';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background p-4">
       <div className="w-full max-w-md pt-8 pb-4">
           <Link href="/" className="flex items-center justify-center">
                <Logo className="text-3xl" />
            </Link>
       </div>
      <main className="flex-1 flex w-full items-start justify-center">
        {children}
      </main>
      <Toaster />
    </div>
  );
}