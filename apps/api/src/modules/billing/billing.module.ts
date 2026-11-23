import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { AdminSubscriptionsController } from './admin-subscriptions.controller.js';
import { BillingController, WebhooksController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { MercadoPagoCheckoutProProvider } from './mercadopago/mercadopago-checkout-pro.provider.js';
import { MercadoPagoPreapprovalProvider } from './mercadopago/mercadopago-preapproval.provider.js';
import { MercadoPagoClient } from './mercadopago/mercadopago.client.js';
import { PAYMENT_PROVIDERS } from './payment-provider.js';
import { PaymentProviders } from './payment-providers.service.js';
import { PlanService } from './plan.service.js';
import { Subscription } from './subscription.entity.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { WebhookEvent } from './webhook-event.entity.js';
import { WebhooksService } from './webhooks.service.js';

/**
 * Billing: plans, checkout, cancellation and Mercado Pago webhooks. It exports
 * `PlanService`, the single source of a user's effective plan.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Subscription, WebhookEvent, User])],
  controllers: [BillingController, WebhooksController, AdminSubscriptionsController],
  providers: [
    MercadoPagoClient,
    MercadoPagoPreapprovalProvider,
    MercadoPagoCheckoutProProvider,
    {
      provide: PAYMENT_PROVIDERS,
      inject: [MercadoPagoPreapprovalProvider, MercadoPagoCheckoutProProvider],
      useFactory: (
        preapproval: MercadoPagoPreapprovalProvider,
        checkoutPro: MercadoPagoCheckoutProProvider,
      ) => [preapproval, checkoutPro],
    },
    PaymentProviders,
    PlanService,
    BillingService,
    WebhooksService,
    SubscriptionsService,
  ],
  exports: [SubscriptionsService, PlanService],
})
export class BillingModule {}
