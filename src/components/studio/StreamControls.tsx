'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Radio, StopCircle, Loader2, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface StreamControlsProps {
  isLive: boolean;
  isStarting: boolean;
  onGoLive: () => void;
  onEndLive: () => void;
  streamId: string | null;
}

export function StreamControls({
  isLive,
  isStarting,
  onGoLive,
  onEndLive,
  streamId,
}: StreamControlsProps) {
  const { toast } = useToast();

  const handleShare = () => {
    if (!streamId) return;
    const url = `${window.location.origin}/buyer/live/${streamId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Stream Link Copied!',
        description: 'You can now share this link with your viewers.',
      });
    }).catch(err => {
      console.error('Failed to copy stream link: ', err);
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy the stream link to your clipboard.',
      });
    });
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-center gap-4">
        {!isLive ? (
          <Button
            size="lg"
            className="font-bold text-lg bg-red-600 hover:bg-red-700"
            onClick={onGoLive}
            disabled={isStarting}
          >
            {isStarting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Radio className="mr-2 h-5 w-5" />
            )}
            {isStarting ? 'Starting...' : 'Go Live'}
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="outline"
              className="font-bold text-lg"
              onClick={handleShare}
            >
              <Share2 className="mr-2 h-5 w-5" />
              Share Stream Link
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="font-bold text-lg"
              onClick={onEndLive}
            >
              <StopCircle className="mr-2 h-5 w-5" />
              End Live Stream
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
