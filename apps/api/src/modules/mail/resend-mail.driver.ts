import { type MailDriver, type MailMessage } from './mail.types.js';

export const RESEND_API_URL = 'https://api.resend.com/emails';

export interface ResendOptions {
  apiKey: string;
  from: string;
  /** Overridable for tests. */
  fetch?: typeof fetch;
  url?: string;
}

/** Production driver: Resend's HTTP API through `fetch`, so no SDK is needed. */
export class ResendMailDriver implements MailDriver {
  private readonly fetch: typeof fetch;
  private readonly url: string;

  constructor(private readonly options: ResendOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.url = options.url ?? RESEND_API_URL;
  }

  async send(message: MailMessage): Promise<void> {
    const response = await this.fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // The body may echo the recipient, so only the status is reported.
      throw new Error(`Resend answered ${response.status}`);
    }
  }
}
