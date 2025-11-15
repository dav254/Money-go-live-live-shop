import { cn } from '@/lib/utils';
import * as React from 'react';

export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 50"
    className={cn('text-primary', className)}
    {...props}
  >
    <g fill="currentColor">
      <path d="M11.3,4.9c-2,0-3.8,0.7-5.2,1.9L2.5,3.2C4.8,1.2,7.9,0,11.3,0c7.8,0,14.2,6.4,14.2,14.2c0,4.7-2.3,8.9-6,11.6 l-3.5-3.5c2.4-1.8,4-4.7,4-7.9C20.1,9.4,16.2,4.9,11.3,4.9z" />
      <path d="M29.8,25.8c0-7.8-6.4-14.2-14.2-14.2c-4.7,0-8.9,2.3-11.6,6l3.5,3.5c1.8-2.4,4.7-4,7.9-4c5,0,9.1,4.1,9.1,9.1 s-4.1,9.1-9.1,9.1c-2,0-3.8-0.7-5.2-1.9L2.5,41.8c2.4,2,5.5,3.2,8.8,3.2C23.4,45.1,29.8,38.7,29.8,25.8z" />
    </g>
    <text x="40" y="34" fontFamily="var(--font-space-grotesk), sans-serif" fontWeight="bold" fontSize="30" fill="hsl(var(--foreground))">
      MoneyGo
    </text>
  </svg>
);
