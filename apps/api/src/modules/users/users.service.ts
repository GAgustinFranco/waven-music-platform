import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { containsPattern } from '../../common/dto/pagination.dto.js';
import { type Backdrop, isDefaultAppearance, type Theme } from './appearance.js';
import { Plan } from './plan.js';
import { Role, User } from './user.entity.js';

export interface ExternalProfile {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface UpsertOptions {
  /** Grants the admin role (never removes it). */
  grantAdmin: boolean;
}

const MAX_DISPLAY_NAME = 50;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findById(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return user;
  }

  /**
   * Creates the user on first login. Later logins refresh the email and avatar
   * from the provider but keep the display name the user may have edited.
   */
  async upsertFromProvider(profile: ExternalProfile, options: UpsertOptions): Promise<User> {
    const email = profile.email.toLowerCase();
    const existing =
      (await this.users.findOneBy({ googleId: profile.googleId })) ??
      (await this.users.findOneBy({ email }));

    const user =
      existing ??
      this.users.create({
        googleId: profile.googleId,
        displayName:
          profile.displayName.trim().slice(0, MAX_DISPLAY_NAME) ||
          email.slice(0, email.indexOf('@')),
        role: Role.User,
      });

    user.googleId = profile.googleId;
    user.email = email;
    user.avatarUrl = profile.avatarUrl;
    if (options.grantAdmin) {
      user.role = Role.Admin;
    }

    return this.users.save(user);
  }

  /**
   * Updates the profile. Choosing anything but the default appearance needs
   * Premium (403 `PREMIUM_REQUIRED`); going back to the default is always allowed.
   */
  async updateProfile(
    id: string,
    changes: { displayName?: string; theme?: Theme; backdrop?: Backdrop },
    plan: Plan,
  ): Promise<User> {
    const user = await this.findById(id);
    const appearance = {
      theme: changes.theme ?? user.theme,
      backdrop: changes.backdrop ?? user.backdrop,
    };
    const changesAppearance = changes.theme !== undefined || changes.backdrop !== undefined;
    if (changesAppearance && plan !== Plan.Premium && !isDefaultAppearance(appearance)) {
      throw new ForbiddenException({
        code: 'PREMIUM_REQUIRED',
        message: 'Themes are a Premium feature',
      });
    }
    if (changes.displayName !== undefined) {
      user.displayName = changes.displayName;
    }
    user.theme = appearance.theme;
    user.backdrop = appearance.backdrop;
    return this.users.save(user);
  }

  /** Newest first; `q` matches the email or the display name. */
  async list(
    limit: number,
    offset: number,
    filter: { q?: string; role?: Role } = {},
  ): Promise<{ items: User[]; total: number }> {
    const query = this.users
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'ASC')
      .take(limit)
      .skip(offset);
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
    if (filter.role) {
      query.andWhere('user.role = :role', { role: filter.role });
    }
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  /** Business rule 10: an admin cannot remove their own admin role. */
  async changeRole(actorId: string, targetId: string, role: Role): Promise<User> {
    const user = await this.findById(targetId);
    if (user.role === role) {
      return user;
    }
    if (user.id === actorId && role !== Role.Admin) {
      throw new ConflictException({
        code: 'CANNOT_DEMOTE_SELF',
        message: 'You cannot remove your own admin role',
      });
    }
    user.role = role;
    return this.users.save(user);
  }
}
