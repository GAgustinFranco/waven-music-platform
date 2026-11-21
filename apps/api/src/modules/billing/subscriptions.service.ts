import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { containsPattern } from '../../common/dto/pagination.dto.js';
import { Subscription, type SubscriptionStatus } from './subscription.entity.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
  ) {}

  /** Newest first, with the owner; `q` matches the owner's email or display name. */
  async list(
    limit: number,
    offset: number,
    filter: { status?: SubscriptionStatus; q?: string } = {},
  ): Promise<{ items: Subscription[]; total: number }> {
    const query = this.subscriptions
      .createQueryBuilder('subscription')
      .innerJoinAndSelect('subscription.user', 'user')
      .orderBy('subscription.createdAt', 'DESC')
      .addOrderBy('subscription.id', 'ASC')
      .take(limit)
      .skip(offset);
    if (filter.status) {
      query.andWhere('subscription.status = :status', { status: filter.status });
    }
    if (filter.q) {
      const pattern = containsPattern(filter.q);
      query.andWhere(
        new Brackets((where) =>
          where
            .where('user.email ILIKE :pattern', { pattern })
            .orWhere('user.displayName ILIKE :pattern', { pattern }),
        ),
      );
    }
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }
}
