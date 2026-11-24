'use client';

import { useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { lerp, useAnimationFrame } from '@/features/auth/backdrop/shared';
import { usePlayerStore } from '@/stores/player.store';

/** Seconds per drift loop for each light; long and coprime, so the pattern never visibly repeats. */
const DRIFT = [
  { x: 11, y: 13, dx: 60, dy: 40 },
  { x: 15, y: 9, dx: 70, dy: 50 },
  { x: 17, y: 12, dx: -80, dy: 40 },
] as const;

/**
 * The Premium "Ambient" backdrop: three blurred lights in the theme's colors
 * (accent, accent-2 and glow) drifting slowly behind the content. They breathe
 * a little while music plays and settle when it stops. Only transforms change,
 * so it stays on the compositor; under prefers-reduced-motion the lights stand
 * still. With the Dynamic theme they follow the cover through the tokens.
 */
export function AmbientBackdrop() {
  const lights = useRef<(HTMLDivElement | null)[]>([]);
  const breathe = useRef(0);
  const reduceMotion = useReducedMotion() ?? false;
  const playing = usePlayerStore((state) => state.isPlaying);

  useAnimationFrame((now) => {
    breathe.current = lerp(breathe.current, playing ? 1 : 0, 0.02);
    const t = now / 1000;
    const scale = 1 + Math.sin(t * 1.4) * 0.035 * breathe.current;
    DRIFT.forEach((drift, index) => {
      const light = lights.current[index];
      if (!light) {
        return;
      }
      const x = Math.sin(t / drift.x) * drift.dx;
      const y = Math.cos(t / drift.y) * drift.dy;
      const s = index === 1 ? 2 - scale : scale;
      light.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    });
  }, !reduceMotion);

  return (
    <div aria-hidden="true" className="ambient-backdrop pointer-events-none fixed inset-0 -z-10">
      {DRIFT.map((_, index) => (
        <div
          key={index}
          ref={(element) => {
            lights.current[index] = element;
          }}
          className={`ambient-light ambient-light-${index + 1}`}
        />
      ))}
    </div>
  );
}
