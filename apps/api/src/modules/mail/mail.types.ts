/** A rendered email, ready for any driver. */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback for clients that do not render HTML. */
  text: string;
}

/** Sends email, like `StorageDriver` stores files: one implementation per environment. */
export interface MailDriver {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_DRIVER = Symbol('MAIL_DRIVER');

/** Hides most of an address so logs never carry the full email. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) {
    return '***';
  }
  return `${email[0] ?? ''}***${email.slice(at)}`;
}
