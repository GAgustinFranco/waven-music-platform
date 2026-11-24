import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables, MailDriverKind, NodeEnv } from '../../config/env.validation.js';
import { LogMailDriver } from './log-mail.driver.js';
import { MailService } from './mail.service.js';
import { MAIL_DRIVER, type MailDriver } from './mail.types.js';
import { MemoryMailDriver } from './memory-mail.driver.js';
import { ResendMailDriver } from './resend-mail.driver.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): MailDriver => {
        switch (config.get('MAIL_DRIVER', { infer: true })) {
          case MailDriverKind.Resend:
            // validateEnv already requires the key with this driver.
            return new ResendMailDriver({
              apiKey: config.get('RESEND_API_KEY', { infer: true }) ?? '',
              from: config.get('MAIL_FROM', { infer: true }),
            });
          case MailDriverKind.Memory:
            return new MemoryMailDriver();
          case MailDriverKind.Log:
            return new LogMailDriver(
              config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production,
            );
        }
      },
    },
    MailService,
  ],
  exports: [MailService, MAIL_DRIVER],
})
export class MailModule {}
