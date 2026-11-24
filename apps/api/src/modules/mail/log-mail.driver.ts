import { Logger } from '@nestjs/common';
import { type MailDriver, type MailMessage, maskEmail } from './mail.types.js';

const LINK = /https?:\/\/\S+/g;

/**
 * Development driver: nothing is sent, the email is only logged. Outside
 * production it also logs the links, so a verification link can be opened from
 * the API output; in production the links (which carry tokens) are left out.
 */
export class LogMailDriver implements MailDriver {
  private readonly logger = new Logger('Mail');

  constructor(private readonly includeLinks: boolean) {}

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      {
        to: maskEmail(message.to),
        subject: message.subject,
        ...(this.includeLinks ? { links: message.text.match(LINK) ?? [] } : {}),
      },
      'Email not sent (MAIL_DRIVER=log)',
    );
    return Promise.resolve();
  }
}
