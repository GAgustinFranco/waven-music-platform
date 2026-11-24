'use client';

import { useMutation } from '@tanstack/react-query';
import { cn } from 'cn';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  authErrorFromApi,
  type AuthFormErrors,
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  registerWithPassword,
  signInWithPassword,
  validateAuthForm,
} from '@/lib/api/auth';

type Mode = 'sign-in' | 'sign-up';
type FieldName = 'email' | 'password' | 'displayName';

const FIELD =
  'bg-surface-2/80 border-input text-foreground placeholder:text-muted-foreground aria-invalid:border-danger h-11 w-full rounded-lg border px-3 text-sm';

const MODES: { value: Mode; label: string }[] = [
  { value: 'sign-in', label: 'Sign in' },
  { value: 'sign-up', label: 'Create account' },
];

interface FieldProps {
  name: FieldName;
  label: string;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength?: number;
  inputRef?: (element: HTMLInputElement | null) => void;
}

/** Labelled input whose error or hint is announced through `aria-describedby`. */
function Field({
  name,
  label,
  type,
  autoComplete,
  value,
  onChange,
  error,
  hint,
  maxLength,
  inputRef,
}: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        maxLength={maxLength}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD}
      />
      {message ? (
        <p
          id={messageId}
          className={cn('text-xs', error ? 'text-danger' : 'text-muted-foreground')}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Email and password sign-in and sign-up, next to "Continue with Google". */
export function PasswordAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [values, setValues] = useState({ email: '', password: '', displayName: '' });
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const inputs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});

  const submit = useMutation({
    mutationFn: () =>
      mode === 'sign-in'
        ? signInWithPassword({ email: values.email.trim(), password: values.password })
        : registerWithPassword({
            email: values.email.trim(),
            password: values.password,
            displayName: values.displayName.trim(),
          }),
    onSuccess: () => router.replace('/'),
    onError: (error) => {
      const apiErrors = authErrorFromApi(error);
      setErrors(apiErrors);
      if (apiErrors.email) {
        inputs.current.email?.focus();
      }
    },
  });

  const update = (field: FieldName) => (value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Errors only show after the first submit, then follow the typing.
    if (submitted) {
      setErrors(validateAuthForm(mode, next));
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors(submitted ? validateAuthForm(next, values) : {});
    submit.reset();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const found = validateAuthForm(mode, values);
    setErrors(found);
    const firstInvalid = (['displayName', 'email', 'password'] as const).find(
      (field) => found[field],
    );
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus();
      return;
    }
    submit.mutate();
  };

  const signingUp = mode === 'sign-up';
  const pending = submit.isPending;

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="group"
        aria-label="Account"
        className="bg-surface-2/80 border-border grid grid-cols-2 gap-1 rounded-lg border p-1"
      >
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => switchMode(option.value)}
            className={cn(
              'rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              mode === option.value
                ? 'bg-elevated text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form
        noValidate
        onSubmit={onSubmit}
        aria-label={signingUp ? 'Create an account' : 'Sign in with email'}
        className="flex flex-col gap-4"
      >
        {signingUp ? (
          <Field
            name="displayName"
            label="Display name"
            type="text"
            autoComplete="nickname"
            value={values.displayName}
            onChange={update('displayName')}
            error={errors.displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            inputRef={(element) => {
              inputs.current.displayName = element;
            }}
          />
        ) : null}
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          maxLength={320}
          inputRef={(element) => {
            inputs.current.email = element;
          }}
        />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          value={values.password}
          onChange={update('password')}
          error={errors.password}
          hint={signingUp ? 'At least 8 characters.' : undefined}
          maxLength={PASSWORD_MAX_LENGTH}
          inputRef={(element) => {
            inputs.current.password = element;
          }}
        />

        {errors.form ? (
          <p role="alert" className="text-danger text-sm">
            {errors.form}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="shadow-brand/40 relative h-11 w-full overflow-hidden rounded-lg font-semibold shadow-lg"
        >
          {/* A light that sweeps across the button every few seconds. */}
          <span
            aria-hidden="true"
            className="via-foreground/40 motion-safe:animate-shine pointer-events-none absolute inset-0 -translate-x-full bg-linear-[110deg] from-transparent from-30% to-transparent to-70%"
          />
          {pending
            ? signingUp
              ? 'Creating account…'
              : 'Signing in…'
            : signingUp
              ? 'Create account'
              : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
