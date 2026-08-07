import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Vidnov "Neural Flow" Logo
 * A professional and unique brand mark designed for social commerce velocity.
 * Features a geometric 'V' with integrated depth and high-fidelity gradients.
 */
export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 500 160"
    className={cn('text-foreground', className)}
    {...props}
  >
    <defs>
      <linearGradient id="vidnov-flow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00E0FF" /> {/* High-Vel Blue */}
        <stop offset="100%" stopColor="#FF00D6" /> {/* Signal Pink */}
      </linearGradient>
      <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* Geometric V Neural Mark */}
    <g transform="translate(10, 10)">
      <path
        d="M20 0 L70 0 L100 120 L50 120 Z"
        fill="url(#vidnov-flow)"
      />
      <path
        d="M110 0 L160 0 L130 120 L80 120 Z"
        fill="url(#vidnov-flow)"
        opacity="0.8"
      />
      <path
        d="M85 45 L85 85 L115 65 Z"
        fill="white"
        filter="url(#glow-effect)"
      />
    </g>

    {/* Professional Typography Node */}
    <g transform="translate(180, 105)">
      <text style={{ font: '900 82px Sora, sans-serif', letterSpacing: '-0.04em' }}>
        <tspan fill="currentColor" className="dark:fill-white fill-black">VIDNO</tspan>
        <tspan fill="#FF0000">V</tspan>
      </text>
      
      <rect x="0" y="15" width="280" height="4" fill="url(#vidnov-flow)" rx="2" />
      
      <text y="45" x="2" style={{ font: 'bold 12px Orbitron, sans-serif', letterSpacing: '0.6em' }} fill="currentColor" className="opacity-60 uppercase">
        POST • EARN • REPEAT
      </text>
    </g>
  </svg>
);
