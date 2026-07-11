import { cn } from '@/lib/utils';
import * as React from 'react';

export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 200"
    className={cn('text-foreground', className)}
    {...props}
  >
    <defs>
      <linearGradient id="vGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00A3FF" />
        <stop offset="50%" stopColor="#7000FF" />
        <stop offset="100%" stopColor="#FF005C" />
      </linearGradient>
    </defs>
    
    {/* Stylized Ribbon V with Play Signal */}
    <g transform="translate(140, 20)">
      <path
        d="M20 0 L50 0 L70 80 L110 20 L130 40 L80 110 L40 110 L10 20 Z"
        fill="url(#vGradient)"
      />
      {/* Inner Play Triangle */}
      <path
        d="M85 55 L85 85 L110 70 Z"
        fill="#FF005C"
      />
    </g>

    {/* VIDNOV Text styling: White then Red V */}
    <text x="50%" y="155" textAnchor="middle" style={{ font: '900 64px Sora, sans-serif', letterSpacing: '-0.02em' }}>
      <tspan fill="currentColor" className="dark:fill-white fill-black">VIDNO</tspan>
      <tspan fill="#FF005C">V</tspan>
    </text>
    
    {/* Tagline and Decorative Lines */}
    <g transform="translate(200, 185)">
      <text textAnchor="middle" style={{ font: 'bold 14px Orbitron, sans-serif', letterSpacing: '0.4em' }} fill="currentColor" className="opacity-90 uppercase">
        POST • EARN • REPEAT
      </text>
      {/* Blue Line Left */}
      <rect x="-170" y="-6" width="40" height="2" fill="#00A3FF" />
      {/* Pink Line Right */}
      <rect x="130" y="-6" width="40" height="2" fill="#FF005C" />
    </g>
  </svg>
);
