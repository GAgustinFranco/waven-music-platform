import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { getEffectivePlan, type Plan, PREMIUM_STATUSES } from '../users/plan.js';
import { Subscription } from './subscription.entity.js';

/** The effective plan of a user, derived from their subscriptions (business rule 1). */
@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
  ) {}

  async getPlan(userId: string, now = new Date()): Promise<Plan> {
    const candidates = await this.subscriptions.find({
      select: { status: true, currentPeriodEnd: true },
      where: { userId, status: In([...PREMIUM_STATUSES]), currentPeriodEnd: MoreThan(now) },
    });
    return getEffectivePlan(candidates, now);
  }
}
