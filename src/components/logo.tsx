import { cn } from '@/lib/utils';
import * as React from 'react';

export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 260 65"
    className={cn('text-primary', className)}
    {...props}
  >
    {/* Motion lines on the left */}
    <rect x="2" y="24" width="8" height="3" rx="1.5" fill="#E11D48" />
    <rect x="0" y="30.5" width="12" height="3" rx="1.5" fill="#E11D48" />
    <rect x="2" y="37" width="8" height="3" rx="1.5" fill="#E11D48" />
    
    {/* Red Play Shape Background */}
    <path 
      d="M15 14C15 11.1702 18.0638 9.40426 20.5 10.8213L52.5 28.8213C54.9362 30.2383 54.9362 33.7617 52.5 35.1787L20.5 53.1787C18.0638 54.5957 15 52.8298 15 50V14Z" 
      fill="#E11D48" 
    />
    
    {/* White 'G' shape */}
    <path 
      d="M42 32C42 38.6274 36.6274 44 30 42C23.3726 44 18 38.6274 18 32C18 25.3726 23.3726 20 30 20V26C26.6863 26 24 28.6863 24 32C24 35.3137 26.6863 38 30 38C33.3137 38 36 35.3137 36 32H30V26H42V32Z" 
      fill="white" 
    />
    
    {/* Gold Coin with $ */}
    <circle cx="30" cy="32" r="7" fill="#FBBF24" />
    <path d="M30 28V36M28 30H31.5C32.5 30 32.5 31.5 31.5 31.5H28.5C27.5 31.5 27.5 33 28.5 33H32" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
    
    {/* GoEarn Text */}
    <text x="65" y="44" style={{ font: 'bold 38px Sora, sans-serif', letterSpacing: '-0.02em' }}>
      <tspan fill="currentColor" className="dark:fill-white fill-black">Go</tspan>
      <tspan fill="#E11D48">Earn</tspan>
    </text>
    
    {/* Tagline System */}
    <g transform="translate(68, 56)">
        <rect y="-4" width="12" height="1.5" fill="#E11D48" />
        <text x="18" y="0" style={{ font: 'bold 10px Orbitron, sans-serif', letterSpacing: '0.18em' }} fill="currentColor" className="opacity-80">
            POST • EARN • REPEAT
        </text>
        <rect x="164" y="-4" width="12" height="1.5" fill="#E11D48" />
    </g>
  </svg>
);
