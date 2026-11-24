import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationType } from '../notifications/notification.entity.js';
import { dedupKeys, NotificationsService } from '../notifications/notifications.service.js';
import { premiumWelcomeEmail } from '../mail/mail.templates.js';
import { PLAN_LIMITS, Plan } from '../users/plan.js';
import { User } from '../users/user.entity.js';
import { applyProviderUpdate } from './apply-provider-update.js';
import { PREMIUM_PERIOD_DAYS, PREMIUM_PRICE, PREMIUM_TITLE } from './billing.constants.js';
import { type BillingStatusDto, type PlansDto, SubscriptionDto } from './billing.dto.js';
import { MERCADO_PAGO, type ProviderUpdate } from './payment-provider.js';
import { PaymentProviders } from './payment-providers.service.js';
import { PlanService } from './plan.service.js';
import { PaymentMode, Subscription, SubscriptionStatus } from './subscription.entity.js';

const { Pending, Authorized, Paused, Cancelled } = SubscriptionStatus;

/**
 * Statuses that block a new checkout. Business rule 8 names pending and
 * authorized; a paused subscription also blocks, since it can resume.
 */
const OPEN_STATUSES = [Pending, Authorized, Paused];

function providerFailed(): BadGatewayException {
  return new BadGatewayException({
    code: 'PAYMENT_PROVIDER_ERROR',
    message: 'Mercado Pago could not be reached. Try again in a moment.',
  });
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly backUrl: string;
  private readonly testPayerEmail: string | undefined;
  private readonly webUrl: string;

  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly providers: PaymentProviders,
    private readonly plans: PlanService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/+$/, '');
    // Mercado Pago needs a public https URL; GET /billing/return forwards to WEB_URL.
    const origin =
      config.get('MP_PUBLIC_URL', { infer: true }) ?? config.get('WEB_URL', { infer: true });
    this.backUrl = `${origin.replace(/\/+$/, '')}/api/billing/return`;
    this.testPayerEmail = config.get('MP_TEST_PAYER_EMAIL', { infer: true });
  }

  getPlans(): PlansDto {
    return {
      mode: this.providers.current().mode,
      items: [
        {
          id: Plan.Free,
          name: 'Free',
          amount: 0,
          currency: PREMIUM_PRICE.currency,
          periodDays: null,
          limits: { ...PLAN_LIMITS[Plan.Free] },
        },
        {
          id: Plan.Premium,
          name: 'Premium',
          amount: PREMIUM_PRICE.amount,
          currency: PREMIUM_PRICE.currency,
          periodDays: PREMIUM_PERIOD_DAYS,
          limits: { ...PLAN_LIMITS[Plan.Premium] },
        },
      ],
    };
  }

  async getStatus(userId: string): Promise<BillingStatusDto> {
    await this.syncPending(userId);
    const [plan, latest] = await Promise.all([
      this.plans.getPlan(userId),
      this.subscriptions.findOne({ where: { userId }, order: { createdAt: 'DESC', id: 'ASC' } }),
    ]);
    return { plan, subscription: latest ? SubscriptionDto.from(latest) : null };
  }

  /** Creates a `pending` subscription and the provider's checkout (business rule 8). */
  async checkout(userId: string): Promise<{ redirectUrl: string }> {
    const provider = this.providers.current();
    if (!provider.isAvailable()) {
      throw new ServiceUnavailableException({
        code: 'BILLING_UNAVAILABLE',
        message: 'Payments are not configured',
      });
    }
    const user = await this.users.findOneByOrFail({ id: userId });

    const subscription = await this.dataSource.transaction(async (manager) => {
      // Serializes checkouts per user; the partial unique index backs this up.
      await manager.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE', [userId]);
      await this.closeEndedPasses(manager, userId);
      const open = await manager.exists(Subscription, {
        where: { userId, status: In(OPEN_STATUSES) },
      });
      // A onetime pass bought while a cancelled one still runs starts where that one ends.
      const remaining =
        provider.mode === PaymentMode.Onetime
          ? await manager.findOne(Subscription, {
              where: { userId, status: Cancelled, currentPeriodEnd: MoreThan(new Date()) },
              order: { currentPeriodEnd: 'DESC' },
            })
          : null;
      if (open) {
        throw new ConflictException({
          code: 'SUBSCRIPTION_EXISTS',
          message: 'You already have a subscription in progress',
        });
      }
      return manager.save(
        manager.create(Subscription, {
          userId,
          provider: MERCADO_PAGO,
          mode: provider.mode,
          status: Pending,
          amount: PREMIUM_PRICE.amount,
          currency: PREMIUM_PRICE.currency,
          externalId: null,
          // Not Premium while pending (business rule 1); the first payment extends from here.
          currentPeriodEnd: remaining?.currentPeriodEnd ?? null,
          cancelledAt: null,
          lastPaymentId: null,
        }),
      );
    });

    try {
      const session = await provider.createCheckout({
        subscriptionId: subscription.id,
        amount: PREMIUM_PRICE.amount,
        currency: PREMIUM_PRICE.currency,
        title: PREMIUM_TITLE,
        payerEmail: this.testPayerEmail ?? user.email,
        backUrl: this.backUrl,
      });
      await this.subscriptions.update(subscription.id, { externalId: session.externalId });
      return { redirectUrl: session.redirectUrl };
    } catch (error) {
      // Nothing was paid yet: drop the row so the user can try again.
      await this.subscriptions.delete(subscription.id);
      this.logger.error(
        { err: error, subscriptionId: subscription.id },
        'Checkout could not be created',
      );
      throw providerFailed();
    }
  }

  /**
   * Cancels the open subscription. In preapproval mode Mercado Pago stops the
   * charges first (business rule 8); the paid period is kept (business rule 1).
   */
  async cancel(userId: string): Promise<BillingStatusDto> {
    const open = await this.subscriptions.findOne({
      where: { userId, status: In(OPEN_STATUSES) },
      order: { createdAt: 'DESC' },
    });
    if (!open) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'There is no subscription to cancel',
      });
    }
    if (open.externalId) {
      try {
        await this.providers.forMode(open.mode).cancel(open.externalId);
      } catch (error) {
        this.logger.error({ err: error, subscriptionId: open.id }, 'Cancellation failed');
        throw providerFailed();
      }
    }
    await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, open.id);
      if (locked && locked.status !== Cancelled) {
        locked.status = Cancelled;
        locked.cancelledAt = new Date();
        await manager.save(locked);
      }
    });
    return this.getStatus(userId);
  }

  /**
   * Applies an update read from the provider, inside the webhook's transaction.
   * Returns the subscription when this update activated it (`pending` →
   * `authorized`), so the caller sends the Premium welcome after the commit.
   * The row lock and the state machine (nothing goes back to `pending`) make
   * that happen once per subscription, whatever the retries or the sync race.
   * The in-app "You're on Premium" notification is written in the same
   * transaction, and its dedup key backs that guarantee up.
   */
  async applyUpdate(
    manager: EntityManager,
    update: ProviderUpdate,
    providerMode: PaymentMode,
  ): Promise<Subscription | null> {
    const subscription = await this.lock(manager, update.subscriptionId);
    if (!subscription) {
      this.logger.warn(
        { subscriptionId: update.subscriptionId },
        'Update for an unknown subscription',
      );
      return null;
    }
    const from = subscription.status;
    const result = applyProviderUpdate(subscription, update, providerMode);
    if (result !== 'applied') {
      this.logger.warn(
        { subscriptionId: subscription.id, from, to: update.status, result },
        'Subscription update ignored',
      );
      return null;
    }
    await manager.save(subscription);
    this.logger.log(
      { subscriptionId: subscription.id, from, to: subscription.status },
      'Subscription updated',
    );
    if (from !== Pending || subscription.status !== Authorized) {
      return null;
    }
    await this.notifications.notify(
      {
        userId: subscription.userId,
        type: NotificationType.PremiumActivated,
        dedupKey: dedupKeys.premiumActivated(subscription.id),
        data: { subscriptionId: subscription.id },
      },
      manager,
    );
    return subscription;
  }

  /** Fire-and-forget Premium welcome; call it only after the activation committed. */
  sendPremiumWelcome(subscription: Pick<Subscription, 'id' | 'userId'>): void {
    const send = async () => {
      const user = await this.users.findOneBy({ id: subscription.userId });
      if (user) {
        await this.mail.send(
          user.email,
          'premium-welcome',
          premiumWelcomeEmail({ displayName: user.displayName, appUrl: `${this.webUrl}/` }),
        );
      }
    };
    send().catch((error: unknown) => {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          subscriptionId: subscription.id,
        },
        'Premium welcome could not be sent',
      );
    });
  }

  /**
   * Fallback for a late or lost webhook: while the newest subscription is
   * pending, its state is read from the provider (never from the client).
   * A failure here only logs; the webhook still settles it later.
   */
  private async syncPending(userId: string): Promise<void> {
    const pending = await this.subscriptions.findOne({
      where: { userId, status: Pending },
      order: { createdAt: 'DESC' },
    });
    if (!pending?.externalId) {
      return;
    }
    const provider = this.providers.forMode(pending.mode);
    try {
      const update = await provider.sync(pending.id, pending.externalId);
      if (update && update.subscriptionId === pending.id) {
        const activated = await this.dataSource.transaction((manager) =>
          this.applyUpdate(manager, update, provider.mode),
        );
        if (activated) {
          this.sendPremiumWelcome(activated);
        }
      }
    } catch (error) {
      this.logger.warn({ err: error, subscriptionId: pending.id }, 'Pending sync failed');
    }
  }

  private lock(manager: EntityManager, id: string): Promise<Subscription | null> {
    return manager.findOne(Subscription, { where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  /** A onetime pass whose 30 days ran out is closed, so the user can buy another one. */
  private async closeEndedPasses(manager: EntityManager, userId: string): Promise<void> {
    const ended = await manager.find(Subscription, {
      where: {
        userId,
        mode: PaymentMode.Onetime,
        status: Authorized,
        currentPeriodEnd: LessThanOrEqual(new Date()),
      },
    });
    for (const pass of ended) {
      pass.status = Cancelled;
      pass.cancelledAt = pass.currentPeriodEnd;
      await manager.save(pass);
    }
  }
}
