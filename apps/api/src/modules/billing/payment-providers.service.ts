import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment-provider.js';
import { type PaymentMode } from './subscription.entity.js';

/**
 * Picks a provider: `PAYMENT_MODE` for new checkouts, the subscription's own
 * mode for cancellations and the notification type for webhooks, so existing
 * subscriptions keep working after the mode is switched.
 */
@Injectable()
export class PaymentProviders {
  private readonly mode: PaymentMode;

  constructor(
    @Inject(PAYMENT_PROVIDERS) private readonly providers: readonly PaymentProvider[],
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.mode = config.get('PAYMENT_MODE', { infer: true });
  }

  current(): PaymentProvider {
    return this.forMode(this.mode);
  }

  forMode(mode: PaymentMode): PaymentProvider {
    const provider = this.providers.find((candidate) => candidate.mode === mode);
    if (!provider) {
      throw new Error(`No payment provider for mode ${mode}`);
    }
    return provider;
  }

  forNotification(type: string): PaymentProvider | undefined {
    return this.providers.find((provider) => provider.notificationTypes.includes(type));
  }
}
