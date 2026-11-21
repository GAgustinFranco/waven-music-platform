import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';

/**
 * Decorative art for empty states: a disc on sound waves, in the brand gradient,
 * with the state's icon on top. Fixed size, so it never shifts the layout, and the
 * floating notes only move with `motion-safe`.
 */
export function EmptyIllustration({ icon: Icon }: { icon: LucideIcon }) {
  const gradient = `${useId()}-gradient`;
  return (
    <div aria-hidden="true" className="relative h-24 w-32 shrink-0">
      <svg viewBox="0 0 128 96" className="absolute inset-0 size-full" fill="none">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--accent)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent-2)' }} />
          </linearGradient>
        </defs>
        {/* Sound waves either side of the disc. */}
        <g className="stroke-brand" strokeLinecap="round" strokeWidth="2">
          <path d="M30 34 q-8 14 0 28" opacity="0.6" />
          <path d="M20 26 q-14 22 0 44" opacity="0.35" />
          <path d="M98 34 q8 14 0 28" opacity="0.6" />
          <path d="M108 26 q14 22 0 44" opacity="0.35" />
        </g>
        <circle cx="64" cy="48" r="30" className="fill-surface-2" />
        <circle cx="64" cy="48" r="30" stroke={`url(#${gradient})`} strokeWidth="2.5" />
        <circle cx="64" cy="48" r="21" className="stroke-border" strokeWidth="1" />
        <g className="fill-brand-2 motion-safe:animate-float">
          <circle cx="104" cy="14" r="3" />
          <rect x="106" y="2" width="1.6" height="12" rx="0.8" />
        </g>
        <g className="fill-brand motion-safe:animate-float [animation-delay:1.2s]">
          <circle cx="22" cy="84" r="2.5" />
          <rect x="23.6" y="74" width="1.4" height="10" rx="0.7" />
        </g>
      </svg>
      <Icon className="text-foreground absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}
