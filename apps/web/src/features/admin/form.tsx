'use client';

import { type ReactNode, useId } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { FIELD } from './table';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  required?: boolean;
  type?: 'text' | 'date' | 'number' | 'url';
  multiline?: boolean;
  hint?: string;
  /** Shown instead of the hint once the field was touched or submitted. */
  error?: string | null;
  min?: number;
  max?: number;
}

/** Labelled input with a fixed-height hint/error line, so errors never shift the layout. */
export function TextField({
  label,
  value,
  onChange,
  maxLength,
  required,
  type = 'text',
  multiline,
  hint,
  error,
  min,
  max,
}: TextFieldProps) {
  const id = useId();
  const describedBy = `${id}-hint`;
  const common = {
    id,
    value,
    required,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: FIELD,
  } as const;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? null : <span className="text-muted-foreground font-normal"> (optional)</span>}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
          className={cn(FIELD, 'resize-y')}
        />
      ) : (
        <input
          {...common}
          type={type}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <p
        id={describedBy}
        className={error ? 'text-danger min-h-5 text-xs' : 'text-muted-foreground min-h-5 text-xs'}
      >
        {error ?? hint ?? ''}
      </p>
    </div>
  );
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Dialog whose body is only mounted while open, so each opening starts from fresh state. */
export function FormDialog({ open, onOpenChange, title, description, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        {open ? children : null}
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? 'Deleting…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Empty strings become `null`, which the API stores as "no value". */
export const orNull = (value: string) => (value.trim() ? value.trim() : null);
