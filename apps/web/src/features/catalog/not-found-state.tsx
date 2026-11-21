import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/catalog/states';
import { Button } from '@/components/ui/button';

export function NotFoundState({ kind }: { kind: 'album' | 'artist' | 'playlist' }) {
  return (
    <div className="px-gutter lg:px-gutter-lg pt-20">
      <EmptyState
        icon={SearchX}
        as="h1"
        title={`We couldn't find that ${kind}`}
        description="It may have been removed, or the link is wrong."
      >
        <Button asChild variant="secondary">
          <Link href="/">Go to Home</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
