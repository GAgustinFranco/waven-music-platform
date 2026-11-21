import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sign in' };

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Google sign-in did not complete. Please try again.',
};

async function LoginError({ searchParams }: { searchParams: PageProps<'/login'>['searchParams'] }) {
  const { error } = await searchParams;
  const message = typeof error === 'string' ? ERROR_MESSAGES[error] : undefined;
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="bg-card text-card-foreground border-border flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border p-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Waven</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to start listening. No password needed.
          </p>
        </div>
        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>
        {/* A full page navigation: the API redirects to Google and back. */}
        <Button asChild size="lg" className="w-full">
          <a href="/api/auth/google">Continue with Google</a>
        </Button>
      </div>
    </main>
  );
}
