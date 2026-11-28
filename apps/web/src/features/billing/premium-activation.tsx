'use client';

import { useQuery } from '@tanstack/react-query';
import { Gem } from 'lucide-react';
import { motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BackdropTile, fillCovers } from '@/features/auth/backdrop/shared';
import { showcaseQuery } from '@/lib/api/catalog';
import { EASE_STANDARD } from '@/lib/motion';

const RING = 8;
/** Ring radius and where each cover starts, in px from the gem. */
const RING_RADIUS = 112;
const START_RADIUS = 560;
const FLY_S = 0.85;
const STAGGER_S = 0.04;

/** Each cover's start and end offset around the gem. */
const SLOTS = Array.from({ length: RING }, (_, index) => {
  const angle = (index / RING) * Math.PI * 2 - Math.PI / 2;
  // The start is turned a little, so the covers swirl in instead of flying straight.
  const start = angle - 0.9;
  return {
    x: Math.cos(angle) * RING_RADIUS,
    y: Math.sin(angle) * RING_RADIUS,
    fromX: Math.cos(start) * START_RADIUS,
    fromY: Math.sin(start) * START_RADIUS,
  };
});

/**
 * The moment Premium is confirmed: covers fly into a ring around a gem, then
 * "You're on Premium". It's done in under 2 s, and Esc or the button closes it
 * at any time. Under reduced motion `MotionConfig` drops the movement, so only
 * the fades remain.
 */
export function PremiumActivation({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { data } = useQuery(showcaseQuery());
  const covers = fillCovers(data?.covers ?? [], RING);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-background/90 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 z-50 backdrop-blur-md duration-250" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            heading.current?.focus();
          }}
          className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-hidden p-6 text-center outline-none"
        >
          <div aria-hidden="true" className="relative size-72 shrink-0">
            <motion.div
              className="bg-brand/30 absolute inset-16 rounded-full blur-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            />
            {covers.map((cover, index) => {
              const slot = SLOTS[index];
              if (!slot) {
                return null;
              }
              return (
                <motion.div
                  key={index}
                  className="absolute top-1/2 left-1/2 -mt-7 -ml-7 size-14"
                  initial={{ x: slot.fromX, y: slot.fromY, rotate: -40, scale: 1.6, opacity: 0 }}
                  animate={{ x: slot.x, y: slot.y, rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ duration: FLY_S, delay: index * STAGGER_S, ease: EASE_STANDARD }}
                >
                  <BackdropTile
                    cover={cover}
                    sizes="56px"
                    className="ring-border size-full rounded-md shadow-lg ring-1"
                  />
                </motion.div>
              );
            })}
            <motion.div
              className="from-brand to-brand-2 absolute top-1/2 left-1/2 -mt-12 -ml-12 flex size-24 items-center justify-center rounded-full bg-linear-to-br shadow-xl"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.45, ease: EASE_STANDARD }}
            >
              <Gem className="text-primary-foreground size-11" strokeWidth={1.75} />
            </motion.div>
          </div>

          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4, ease: EASE_STANDARD }}
          >
            <DialogPrimitive.Title asChild>
              <h2
                ref={heading}
                tabIndex={-1}
                className="text-3xl font-bold tracking-tight outline-none sm:text-5xl"
              >
                You’re on Premium
              </h2>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground max-w-sm">
              Unlimited playlists and every theme are yours. Thanks for supporting Waven.
            </DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <Button
                size="lg"
                className="bg-brand text-primary-foreground hover:bg-brand-hover mt-2"
              >
                Continue
              </Button>
            </DialogPrimitive.Close>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
