import type { ReactNode } from 'react';

/** A titled page section; its heading names the region for screen readers. */
export function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  /** Shown at the end of the heading row, e.g. a "Show all" link. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight lg:text-2xl">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
