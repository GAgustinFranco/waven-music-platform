import { ForbiddenException } from '@nestjs/common';
import { type DataSource, type EntityManager, type Repository } from 'typeorm';
import { type PlanService } from '../billing/plan.service.js';
import { type CatalogMapper } from '../catalog/catalog.mapper.js';
import { PLAN_LIMITS, Plan } from '../users/plan.js';
import { Playlist } from './playlist.entity.js';
import { canCreatePlaylist, clampPosition, PlaylistsService } from './playlists.service.js';

describe('canCreatePlaylist', () => {
  it('allows Free users up to 5 playlists', () => {
    const free = PLAN_LIMITS[Plan.Free].maxPlaylists;
    expect(canCreatePlaylist(0, free)).toBe(true);
    expect(canCreatePlaylist(4, free)).toBe(true);
    expect(canCreatePlaylist(5, free)).toBe(false);
  });

  it('keeps blocking a downgraded user who owns more than the limit', () => {
    expect(canCreatePlaylist(8, PLAN_LIMITS[Plan.Free].maxPlaylists)).toBe(false);
  });

  it('never blocks an unlimited plan', () => {
    expect(canCreatePlaylist(1_000, PLAN_LIMITS[Plan.Premium].maxPlaylists)).toBe(true);
  });
});

describe('clampPosition', () => {
  it('defaults to the end', () => {
    expect(clampPosition(undefined, 7)).toBe(7);
  });

  it('keeps positions inside [0, max]', () => {
    expect(clampPosition(0, 7)).toBe(0);
    expect(clampPosition(3, 7)).toBe(3);
    expect(clampPosition(99, 7)).toBe(7);
    expect(clampPosition(-2, 7)).toBe(0);
  });
});

describe('PlaylistsService.create', () => {
  function setup(owned: number) {
    const saved: Playlist = Object.assign(new Playlist(), {
      id: 'playlist-1',
      ownerId: 'user-1',
      name: `My Playlist #${owned + 1}`,
      description: null,
      coverKey: null,
      createdAt: new Date('2026-11-21T10:00:00Z'),
      updatedAt: new Date('2026-11-21T10:00:00Z'),
    });
    const queryBuilder = {
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      withDeleted: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    const manager = {
      query: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(owned),
      create: vi.fn((_: unknown, values: Partial<Playlist>) => values),
      save: vi.fn().mockResolvedValue(saved),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      manager,
      transaction: vi.fn((work: (m: EntityManager) => Promise<unknown>) =>
        work(manager as unknown as EntityManager),
      ),
    };
    const service = new PlaylistsService(
      {} as Repository<Playlist>,
      dataSource as unknown as DataSource,
      { track: vi.fn(), imageSet: vi.fn() } as unknown as CatalogMapper,
      { getPlan: vi.fn().mockResolvedValue(Plan.Free) } as unknown as PlanService,
    );
    return { service, manager };
  }

  it('creates a playlist with a numbered default name under the limit', async () => {
    const { service, manager } = setup(2);

    const created = await service.create('user-1', {});

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), ['user-1']);
    expect(manager.create).toHaveBeenCalledWith(Playlist, {
      ownerId: 'user-1',
      name: 'My Playlist #3',
      description: null,
    });
    expect(created).toMatchObject({ id: 'playlist-1', trackCount: 0, entries: [], durationMs: 0 });
  });

  it('keeps the given name and description', async () => {
    const { service, manager } = setup(0);

    await service.create('user-1', { name: 'Road trip', description: 'Loud' });

    expect(manager.create).toHaveBeenCalledWith(Playlist, {
      ownerId: 'user-1',
      name: 'Road trip',
      description: 'Loud',
    });
  });

  it('rejects the sixth Free playlist with PLAN_LIMIT_REACHED', async () => {
    const { service, manager } = setup(5);

    const error: unknown = await service.create('user-1', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
    expect(manager.save).not.toHaveBeenCalled();
  });
});
