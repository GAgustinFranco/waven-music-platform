'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';

/**
 * App-wide toasts (sonner): an `aria-live` region, themed with the design tokens
 * and lifted above the player bar / mini player through `--toast-offset`
 * (globals.css), so a toast never covers the playback controls.
 */
export function Toaster() {
  const offset = { bottom: 'var(--toast-offset)', left: '16px', right: '16px' };
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={offset}
      mobileOffset={offset}
      closeButton
      containerAriaLabel="Notifications"
      style={
        {
          '--normal-bg': 'var(--elevated)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius-md)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          description: '!text-muted-foreground',
          actionButton: '!bg-brand !text-primary-foreground',
          error: '[&_[data-icon]]:!text-danger',
          success: '[&_[data-icon]]:!text-success',
        },
      }}
    />
  );
}
