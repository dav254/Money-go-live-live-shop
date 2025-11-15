import {
  Sidebar,
  SidebarProvider,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu } from 'lucide-react';
import { BuyerSidebarNav, SellerSidebarNav, AccountSidebarNav } from './sidebar-nav';
import { Toaster } from '../ui/toaster';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-72 flex-col bg-card p-4">
                  <Link href="/" className="mb-6">
                    <h1 className="font-headline text-2xl font-bold text-primary">MoneyGo</h1>
                  </Link>
                  <nav className="flex flex-1 flex-col gap-4">
                    <BuyerSidebarNav />
                    <SellerSidebarNav />
                  </nav>
                  <div className="mt-auto">
                    <AccountSidebarNav />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <Link href="/">
              <h1 className="hidden font-headline text-2xl font-bold text-primary md:block">MoneyGo</h1>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Login</Button>
            <Button>Sign Up</Button>
          </div>
        </header>
        <div className="flex flex-1">
          <aside className="hidden w-64 flex-col border-r bg-card md:flex">
            <div className="flex flex-1 flex-col gap-y-4 overflow-y-auto p-4">
              <BuyerSidebarNav />
              <SellerSidebarNav />
            </div>
            <div className="p-4">
              <AccountSidebarNav />
            </div>
          </aside>
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
