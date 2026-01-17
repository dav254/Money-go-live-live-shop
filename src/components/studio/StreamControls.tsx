
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Radio, StopCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StreamControlsProps {
  isLive: boolean;
  isStarting: boolean;
  onGoLive: () => void;
  onEndLive: () => void;
}

export function StreamControls({
  isLive,
  isStarting,
  onGoLive,
  onEndLive,
}: StreamControlsProps) {
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
          <Button
            size="lg"
            variant="destructive"
            className="font-bold text-lg"
            onClick={onEndLive}
          >
            <StopCircle className="mr-2 h-5 w-5" />
            End Live Stream
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
