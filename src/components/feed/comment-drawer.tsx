
'use client';

import { useState } from 'react';
import type { Comment } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface CommentDrawerProps {
  comments: Comment[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddComment: (text: string) => void;
  isLoading: boolean;
}

export function CommentDrawer({ comments, isOpen, onOpenChange, onAddComment, isLoading }: CommentDrawerProps) {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-card/95 text-card-foreground border-t-primary border-t-2 rounded-t-2xl backdrop-blur-md h-[70vh] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="font-headline text-lg text-center">Comments ({comments.length})</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
                {isLoading && (
                  <div className='space-y-4'>
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                     <div className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                  </div>
                )}
                {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 border">
                            <AvatarImage src={comment.userAvatar} />
                            <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">{comment.userName}</p>
                            <p className="text-sm">{comment.text}</p>
                        </div>
                    </div>
                ))}
                 {!isLoading && comments.length === 0 && (
                    <p className="text-center text-muted-foreground pt-12">No comments yet. Be the first to comment!</p>
                )}
            </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-4 border-t">
          <Input 
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
