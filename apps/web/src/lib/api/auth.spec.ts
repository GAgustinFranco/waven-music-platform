import { describe, expect, it } from 'vitest';
import { authErrorFromApi, validateAuthForm } from './auth';
import { ApiError } from './queries';

const valid = { email: 'fan@example.com', password: 'long enough', displayName: 'Fan' };

describe('validateAuthForm', () => {
  it('accepts valid values', () => {
    expect(validateAuthForm('sign-up', valid)).toEqual({});
    expect(validateAuthForm('sign-in', valid)).toEqual({});
  });

  it('asks for an email and a valid one', () => {
    expect(validateAuthForm('sign-in', { ...valid, email: '  ' }).email).toBe('Enter your email.');
    expect(validateAuthForm('sign-in', { ...valid, email: 'fan@' }).email).toMatch(/valid email/);
  });

  it('only enforces the minimum password length on sign-up', () => {
    const short = { ...valid, password: 'short' };
    expect(validateAuthForm('sign-up', short).password).toBe('Use at least 8 characters.');
    expect(validateAuthForm('sign-in', short)).toEqual({});
  });

  it('asks for a display name only on sign-up', () => {
    const noName = { ...valid, displayName: ' ' };
    expect(validateAuthForm('sign-up', noName).displayName).toBeDefined();
    expect(validateAuthForm('sign-in', noName)).toEqual({});
  });
});

describe('authErrorFromApi', () => {
  it('keeps the login error generic', () => {
    expect(authErrorFromApi(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toEqual({
      form: 'Invalid email or password.',
    });
  });

  it('puts a taken email next to the email field', () => {
    expect(authErrorFromApi(new ApiError(409, 'EMAIL_IN_USE', 'x')).email).toMatch(/Sign in/);
  });

  it('explains rate limits and outages', () => {
    expect(authErrorFromApi(new ApiError(429, 'TOO_MANY_REQUESTS', 'x')).form).toMatch(/Wait/);
    expect(authErrorFromApi(new ApiError(502, 'HTTP_ERROR', 'x')).form).toMatch(/can't reach/);
    expect(authErrorFromApi(new TypeError('fetch failed')).form).toMatch(/can't reach/);
  });
});
