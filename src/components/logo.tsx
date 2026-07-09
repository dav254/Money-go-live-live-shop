import { cn } from '@/lib/utils';
import * as React from 'react';

export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 160"
    className={cn('text-foreground', className)}
    {...props}
  >
    <defs>
      <linearGradient id="vidnovGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00A3FF" />
        <stop offset="50%" stopColor="#7000FF" />
        <stop offset="100%" stopColor="#FF005C" />
      </linearGradient>
    </defs>
    
    {/* Stylized 'V' Symbol with Play Button */}
    <g transform="translate(135, 10)">
      {/* The main V shape */}
      <path
        d="M0 10 L35 0 L55 65 L115 10 L135 25 L65 95 L50 95 L0 10Z"
        fill="url(#vidnovGradient)"
      />
      {/* The inner play triangle */}
      <path
        d="M72 38 L72 65 L98 51.5 Z"
        fill="#FF005C"
      />
    </g>

    {/* VIDNOV Text */}
    <text x="50%" y="118" textAnchor="middle" style={{ font: '900 68px Sora, sans-serif', letterSpacing: '-0.02em' }}>
      <tspan fill="currentColor" className="dark:fill-white fill-black">VIDNO</tspan>
      <tspan fill="#FF005C">V</tspan>
    </text>
    
    {/* Tagline */}
    <g transform="translate(200, 148)">
      <text textAnchor="middle" style={{ font: 'bold 16px Orbitron, sans-serif', letterSpacing: '0.45em' }} fill="currentColor" className="opacity-90 uppercase">
        POST • EARN • REPEAT
      </text>
      {/* Decorative accent lines */}
      <rect x="-165" y="-6" width="35" height="2" fill="#00A3FF" />
      <rect x="130" y="-6" width="35" height="2" fill="#FF005C" />
    </g>
  </svg>
);
