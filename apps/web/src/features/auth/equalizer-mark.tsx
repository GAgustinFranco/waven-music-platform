const BARS = [
  { height: '40%', delay: '-0.2s' },
  { height: '90%', delay: '-0.5s' },
  { height: '60%', delay: '-0.8s' },
  { height: '100%', delay: '-0.1s' },
  { height: '50%', delay: '-0.6s' },
];

/** Waven's mark as a small equalizer that dances (still under reduced motion). */
export function EqualizerMark() {
  return (
    <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
      {BARS.map((bar) => (
        <span
          key={bar.delay}
          className="from-brand-2 to-brand motion-safe:animate-equalizer w-1 rounded-full bg-linear-to-b"
          style={{ height: bar.height, animationDelay: bar.delay }}
        />
      ))}
    </span>
  );
}
