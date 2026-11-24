import { ConflictException, NotFoundException } from '@nestjs/common';
import { type Repository } from 'typeorm';
import { Backdrop, DEFAULT_APPEARANCE, effectiveAppearance, Theme } from './appearance.js';
import { Plan } from './plan.js';
import { Role, type User } from './user.entity.js';
import { UsersService } from './users.service.js';

const ADMIN_ID = '0b7f8c2e-1d4a-4f6b-9a3e-5c2d1e0f9a8b';
const OTHER_ID = '6e1d2c3b-4a5f-4e6d-8c7b-9a0f1e2d3c4b';

function setup(stored: User | null) {
  const repository = {
    findOneBy: vi.fn().mockResolvedValue(stored),
    save: vi.fn((user: User) => Promise.resolve(user)),
  };
  const service = new UsersService(repository as unknown as Repository<User>);
  return { service, repository };
}

const user = (id: string, role: Role) => ({ id, role }) as User;

describe('UsersService.changeRole', () => {
  it('promotes another user', async () => {
    const { service, repository } = setup(user(OTHER_ID, Role.User));

    const result = await service.changeRole(ADMIN_ID, OTHER_ID, Role.Admin);

    expect(result.role).toBe(Role.Admin);
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it('demotes another admin', async () => {
    const { service } = setup(user(OTHER_ID, Role.Admin));

    await expect(service.changeRole(ADMIN_ID, OTHER_ID, Role.User)).resolves.toMatchObject({
      role: Role.User,
    });
  });

  it('refuses to let an admin remove their own role', async () => {
    const { service, repository } = setup(user(ADMIN_ID, Role.Admin));

    const attempt = service.changeRole(ADMIN_ID, ADMIN_ID, Role.User);

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'CANNOT_DEMOTE_SELF' },
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('treats setting the current role as a no-op', async () => {
    const { service, repository } = setup(user(ADMIN_ID, Role.Admin));

    await service.changeRole(ADMIN_ID, ADMIN_ID, Role.Admin);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user', async () => {
    const { service } = setup(null);

    await expect(service.changeRole(ADMIN_ID, OTHER_ID, Role.Admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('UsersService.updateProfile (appearance)', () => {
  const stored = () =>
    ({ id: OTHER_ID, displayName: 'Fan', theme: Theme.Violet, backdrop: Backdrop.Solid }) as User;

  it('lets a Premium user pick any theme and backdrop', async () => {
    const { service } = setup(stored());

    const result = await service.updateProfile(
      OTHER_ID,
      { theme: Theme.Ember, backdrop: Backdrop.Glow },
      Plan.Premium,
    );

    expect(result).toMatchObject({ theme: Theme.Ember, backdrop: Backdrop.Glow });
  });

  it.each([{ theme: Theme.Ocean }, { backdrop: Backdrop.Glow }])(
    'refuses %j on the Free plan',
    async (changes) => {
      const { service, repository } = setup(stored());

      await expect(service.updateProfile(OTHER_ID, changes, Plan.Free)).rejects.toMatchObject({
        response: { code: 'PREMIUM_REQUIRED' },
      });
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('lets a Free user go back to the default and still rename', async () => {
    const { service } = setup({ ...stored(), theme: Theme.Rose } as User);

    const result = await service.updateProfile(
      OTHER_ID,
      { displayName: 'New', theme: Theme.Violet },
      Plan.Free,
    );

    expect(result).toMatchObject({ displayName: 'New', theme: Theme.Violet });
  });

  it('keeps a saved theme when a Free user only renames', async () => {
    const { service } = setup({ ...stored(), theme: Theme.Rose } as User);

    const result = await service.updateProfile(OTHER_ID, { displayName: 'New' }, Plan.Free);

    expect(result).toMatchObject({ displayName: 'New', theme: Theme.Rose });
  });
});

describe('effectiveAppearance', () => {
  it('shows the saved choice on Premium and the default on Free', () => {
    const saved = { theme: Theme.Mono, backdrop: Backdrop.Glow };
    expect(effectiveAppearance(saved, true)).toEqual(saved);
    expect(effectiveAppearance(saved, false)).toEqual(DEFAULT_APPEARANCE);
  });
});
