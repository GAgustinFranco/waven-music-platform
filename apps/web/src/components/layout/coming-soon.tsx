import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/catalog/states';

/** Placeholder for navigation targets that later roadmap phases build. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-6 pt-20">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <EmptyState icon={Construction} title="Coming soon" description={description} />
    </div>
  );
}
