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
       <path d="M25,5.1c-2.8,0-5.3,1-7.3,2.6L14,2.9C17.3,1,21,0,25,0c11,0,20,9,20,20c0,6.6-3.2,12.5-8.4,16.2 l-4.9-4.9c3.4-2.5,5.6-6.6,5.6-11.2C37.3,13.1,31.9,7.1,25,5.1z" />
      <circle cx="15" cy="25" r="10" />
    </g>
    <text x="50" y="34" fontFamily="var(--font-space-grotesk), sans-serif" fontWeight="bold" fontSize="30" fill="hsl(var(--foreground))">
      MoneyGo
    </text>
  </svg>
);