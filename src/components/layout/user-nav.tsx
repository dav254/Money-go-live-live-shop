'use client';

import { useUser, useFirestore, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import Link from 'next/link';
import { User, Settings, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function UserNav() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  // The active surface's Auth instance — the website and the installed app each
  // have their own session, so never use the no-argument getAuth() here.
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Presence Tracking
  useEffect(() => {
    if (!user || !firestore) return;
    const userRef = doc(firestore, 'userProfiles', user.uid);
    const updateStatus = () => {
      updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(() => {});
    };
    updateStatus();
    const interval = setInterval(updateStatus, 60000); 
    return () => clearInterval(interval);
  }, [user, firestore]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      // Home, not /login. `/login` is a dead end for someone who did not come
      // here to sign in, and `push` rather than `replace` meant Back walked
      // straight back onto a private screen with no session. This follows the
      // single rule in `src/lib/auth/sign-out-to-home.ts`.
      router.replace('/'); 
    } catch (error) {
      console.error("Sign out error", error);
      toast({ variant: "destructive", title: "Error signing out" });
    }
  };

  if (isUserLoading) return <Skeleton className="h-10 w-10 rounded-full" />;
  if (!user) return <div className="flex items-center gap-2"><Button variant="ghost" asChild><Link href="/login">Login</Link></Button><Button asChild><Link href="/signup">Sign Up</Link></Button></div>;

  return (
     <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.photoURL || '/placeholder-avatar.svg'} />
            <AvatarFallback><User /></AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild><Link href="/dashboard/account"><Settings className="mr-2 h-4 w-4" /><span>Account Settings</span></Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
