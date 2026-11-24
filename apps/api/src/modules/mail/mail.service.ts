import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_DRIVER, type MailDriver } from './mail.types.js';
import { type MailContent } from './mail.templates.js';

/**
 * Sends email without ever blocking or failing the caller: `send` returns at
 * once, and a failure is only logged (without the recipient or the content).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(MAIL_DRIVER) private readonly driver: MailDriver) {}

  /** Fire-and-forget. The returned promise never rejects; callers need not await it. */
  send(to: string, template: string, content: MailContent): Promise<void> {
    let pending: Promise<void>;
    try {
      pending = this.driver.send({ to, ...content });
    } catch (error) {
      pending = Promise.reject(error);
    }
    return pending.catch((error: unknown) => {
      this.logger.error(
        { template, error: error instanceof Error ? error.message : 'Unknown error' },
        'Email could not be sent',
      );
    });
  }
}
