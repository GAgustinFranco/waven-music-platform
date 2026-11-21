'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Slider as SliderPrimitive } from 'radix-ui';

interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  /** Accessible name of the thumb, which is the element with `role="slider"`. */
  label: string;
  /** Spoken value, e.g. "1:05 of 3:20". */
  valueText?: string;
}

/** Single-thumb slider (seek and volume). Keyboard: arrows, Page Up/Down, Home/End. */
function Slider({ className, label, valueText, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        'group/slider relative flex h-4 w-full touch-none items-center select-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="bg-elevated relative h-1 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-foreground group-hover/slider:bg-brand group-has-[:focus-visible]/slider:bg-brand absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="bg-foreground block size-3 rounded-full opacity-0 shadow transition-opacity duration-150 group-hover/slider:opacity-100 focus-visible:opacity-100"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
