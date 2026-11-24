import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GoogleG } from '@/components/icons/google-g';
import { LoginBackdrop } from '@/features/auth/backdrop/login-backdrop';
import { EqualizerMark } from '@/features/auth/equalizer-mark';
import { PasswordAuthForm } from '@/features/auth/password-auth-form';

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
    <p role="alert" className="text-destructive text-center text-sm">
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden p-6">
      {/* One of three interactive covers backdrops, picked at random. */}
      <LoginBackdrop />
      <div className="bg-surface/70 border-foreground/10 relative z-10 flex w-full max-w-100 flex-col gap-5 rounded-2xl border p-6 sm:p-8 shadow-2xl shadow-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-heading flex items-center gap-2.5 text-3xl font-semibold tracking-tight">
            <EqualizerMark />
            Waven
          </h1>
          <p className="text-muted-foreground text-sm">Millions of beats. One place.</p>
        </div>
        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>
        <PasswordAuthForm />
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span aria-hidden="true" className="bg-border h-px flex-1" />
          or continue with
          <span aria-hidden="true" className="bg-border h-px flex-1" />
        </div>
        {/* A full page navigation: the API redirects to Google and back. */}
        <a
          href="/api/auth/google"
          aria-label="Continue with Google"
          title="Continue with Google"
          className="bg-foreground ease-standard hover:ring-brand/40 flex size-13 items-center justify-center self-center rounded-full shadow-lg shadow-background/60 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:scale-105 hover:ring-4 active:scale-95"
        >
          <GoogleG className="size-6" />
        </a>
      </div>
    </main>
  );
}
