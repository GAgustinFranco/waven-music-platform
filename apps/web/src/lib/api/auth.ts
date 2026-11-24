import { useAuthStore } from '@/stores/auth.store';
import { api, CSRF_HEADERS } from './client';
import { ApiError, toApiError } from './queries';
import type { components } from './schema';

export type Credentials = components['schemas']['LoginDto'];
export type Registration = components['schemas']['RegisterDto'];

/** Mirrors the API rules in `RegisterDto`. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 50;

/** Signs in with an email and a password; the API also sets the refresh cookie. */
export async function signInWithPassword(body: Credentials): Promise<void> {
  const { data, error, response } = await api.POST('/auth/login', {
    body,
    params: { header: CSRF_HEADERS },
  });
  if (!data) {
    throw toApiError(error, response);
  }
  useAuthStore.getState().setAccessToken(data.accessToken);
}

/** Creates a password account and signs it in. */
export async function registerWithPassword(body: Registration): Promise<void> {
  const { data, error, response } = await api.POST('/auth/register', {
    body,
    params: { header: CSRF_HEADERS },
  });
  if (!data) {
    throw toApiError(error, response);
  }
  useAuthStore.getState().setAccessToken(data.accessToken);
}

/** Consumes the one-click token from the welcome email. Works signed in or out. */
export async function verifyEmail(token: string): Promise<void> {
  const { error, response } = await api.POST('/auth/verify-email', { body: { token } });
  if (!response.ok) {
    throw toApiError(error, response);
  }
}

export type AuthFormErrors = Partial<Record<'email' | 'password' | 'displayName' | 'form', string>>;

/** A deliberately loose check: the API has the final word. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks shown inline before the request is sent. */
export function validateAuthForm(
  mode: 'sign-in' | 'sign-up',
  values: { email: string; password: string; displayName: string },
): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = values.email.trim();
  if (!email) {
    errors.email = 'Enter your email.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email, like name@example.com.';
  }

  if (!values.password) {
    errors.password = 'Enter your password.';
  } else if (mode === 'sign-up' && values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (mode === 'sign-up' && !values.displayName.trim()) {
    errors.displayName = 'Enter the name other people will see.';
  }
  return errors;
}

/** Turns an API failure into a message placed next to the field it is about. */
export function authErrorFromApi(error: unknown): AuthFormErrors {
  if (!(error instanceof ApiError) || error.statusCode >= 500) {
    return { form: "We can't reach Waven right now. Please try again." };
  }
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return { form: 'Invalid email or password.' };
    case 'EMAIL_IN_USE':
      return { email: 'An account with this email already exists. Sign in instead.' };
    case 'TOO_MANY_REQUESTS':
      return { form: 'Too many attempts. Wait a minute and try again.' };
    case 'BAD_REQUEST':
      return { form: 'Check the fields and try again.' };
    default:
      return { form: 'Something went wrong. Please try again.' };
  }
}
