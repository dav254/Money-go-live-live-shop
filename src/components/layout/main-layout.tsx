

'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu, User, Bell, MessageSquare, Video, Search } from 'lucide-react';
import { BuyerSidebarNav, SellerSidebarNav, AccountSidebarNav } from './sidebar-nav';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { useUser } from '@/firebase';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';

function UserNav() {
  const { user, isUserLoading } = useUser();
  const auth = getAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      router.push('/');
    } catch (error) {
      console.error("Sign out error", error);
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: "There was a problem signing you out. Please try again.",
      });
    }
  };

  if (isUserLoading) {
    return <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />;
  }
  
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild><Link href="/login">Login</Link></Button>
        <Button asChild><Link href="/signup">Sign Up</Link></Button>
      </div>
    );
  }

  return (
     <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || ''} />
            <AvatarFallback>
                <User />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 md:gap-4">
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
                    <Logo className="h-8 w-auto text-primary" />
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
            <Link href="/" className="hidden md:block">
              <Logo className="h-8 w-auto text-primary" />
            </Link>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, orders..." className="pl-9" />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden md:inline-flex">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>
             <Button variant="ghost" size="icon" className="hidden md:inline-flex">
              <MessageSquare className="h-5 w-5" />
              <span className="sr-only">Chat</span>
            </Button>
             <Button variant="ghost" size="icon" className="hidden md:inline-flex">
              <Video className="h-5 w-5" />
              <span className="sr-only">Live</span>
            </Button>
            <UserNav />
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
