import { CircleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyIllustration } from './empty-illustration';

type HeadingLevel = 'h1' | 'h2' | 'h3';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Heading level that fits the surrounding outline. */
  as?: HeadingLevel;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  as: Heading = 'h2',
}: EmptyStateProps) {
  return (
    <div className="bg-surface flex flex-col items-center gap-3 rounded-md px-6 py-10 text-center">
      <EmptyIllustration icon={Icon} />
      <Heading className="text-base font-semibold">{title}</Heading>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {children}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  onRetry: () => void;
  retrying?: boolean;
  as?: HeadingLevel;
}

export function ErrorState({
  title = 'Something went wrong',
  onRetry,
  retrying = false,
  as = 'h2',
}: ErrorStateProps) {
  return (
    <div role="alert">
      <EmptyState
        icon={CircleAlert}
        title={title}
        description="We couldn't load this right now. Check your connection and try again."
        as={as}
      >
        <Button variant="secondary" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Try again'}
        </Button>
      </EmptyState>
    </div>
  );
}

/** Announces a loading region to assistive tech while skeletons are on screen. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}
