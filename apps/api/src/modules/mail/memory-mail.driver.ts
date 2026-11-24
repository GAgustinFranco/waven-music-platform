import { type MailDriver, type MailMessage } from './mail.types.js';

/** Test driver: keeps every message in memory so tests can read it. */
export class MemoryMailDriver implements MailDriver {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** The messages sent to `to`, oldest first. */
  to(to: string): MailMessage[] {
    return this.sent.filter((message) => message.to === to);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
