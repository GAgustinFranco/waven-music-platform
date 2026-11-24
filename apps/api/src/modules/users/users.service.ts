import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
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

export interface ProviderLogin {
  user: User;
  /** True when Google took over a password-only account with the same email. */
  passwordRemoved: boolean;
}

const MAX_DISPLAY_NAME = 50;

const emailInUse = () =>
  new ConflictException({
    code: 'EMAIL_IN_USE',
    message: 'An account with this email already exists. Sign in instead',
  });

/** Postgres `unique_violation`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === '23505'
  );
}

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

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.toLowerCase() });
  }

  /**
   * Creates the user on first login. Later logins refresh the email and avatar
   * from the provider but keep the display name the user may have edited.
   *
   * Google verifies the email and our sign-up does not, so a password-only account
   * with the same email is taken over: its password is removed (`passwordRemoved`)
   * and the caller must end its sessions. Whoever registered the email first
   * therefore cannot lie in wait for its real owner.
   */
  async upsertFromProvider(
    profile: ExternalProfile,
    options: UpsertOptions,
  ): Promise<ProviderLogin> {
    const email = profile.email.toLowerCase();
    const existing =
      (await this.users.findOneBy({ googleId: profile.googleId })) ??
      (await this.users.findOneBy({ email }));

    const user =
      existing ??
      this.users.create({
        googleId: profile.googleId,
        passwordHash: null,
        displayName:
          profile.displayName.trim().slice(0, MAX_DISPLAY_NAME) ||
          email.slice(0, email.indexOf('@')),
        role: Role.User,
      });

    const passwordRemoved = existing !== null && existing.googleId === null;
    if (passwordRemoved) {
      user.passwordHash = null;
    }
    user.googleId = profile.googleId;
    user.email = email;
    user.avatarUrl = profile.avatarUrl;
    if (options.grantAdmin) {
      user.role = Role.Admin;
    }

    return { user: await this.users.save(user), passwordRemoved };
  }

  /** Signs up with an email and a password; 409 `EMAIL_IN_USE` if the email is taken. */
  async createWithPassword(
    input: { email: string; displayName: string; passwordHash: string },
    options: UpsertOptions,
  ): Promise<User> {
    const email = input.email.toLowerCase();
    if (await this.users.existsBy({ email })) {
      throw emailInUse();
    }
    const user = this.users.create({
      googleId: null,
      passwordHash: input.passwordHash,
      email,
      displayName: input.displayName.slice(0, MAX_DISPLAY_NAME),
      avatarUrl: null,
      role: options.grantAdmin ? Role.Admin : Role.User,
    });
    try {
      return await this.users.save(user);
    } catch (error) {
      // Two sign-ups with the same email at once: the unique index decides.
      if (isUniqueViolation(error)) {
        throw emailInUse();
      }
      throw error;
    }
  }

  /** Grants the admin role (used at password login, like `upsertFromProvider`). */
  async grantAdmin(user: User): Promise<User> {
    if (user.role === Role.Admin) {
      return user;
    }
    user.role = Role.Admin;
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
