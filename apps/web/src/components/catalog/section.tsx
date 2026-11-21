import type { ReactNode } from 'react';

/** A titled page section; its heading names the region for screen readers. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight lg:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
