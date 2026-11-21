import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { type DataSource, type EntityManager } from 'typeorm';
import { type CatalogService } from '../catalog/catalog.service.js';
import { Track } from '../catalog/entities/track.entity.js';
import { type RecordPlayDto } from './history.dto.js';
import { HistoryService, requiredPlayMs } from './history.service.js';
import { PlayContext } from './play-history.entity.js';

const PLAY_ID = '5b0c6f4e-3c1a-4c3e-9a8e-2f6f1d7c9b10';
const TRACK_ID = 'a1f3d3a4-7e0e-4b8e-8f3c-6f9e2c1d0b2a';

function setup(durationMs: number | null = 180_000, inserted: unknown[] = [{ id: 'row-1' }]) {
  const manager = {
    query: vi.fn().mockResolvedValue(inserted),
    increment: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = {
    transaction: vi.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  const catalog = {
    findReadyTrack: vi.fn().mockResolvedValue({ id: TRACK_ID, durationMs } as Track),
  };
  const service = new HistoryService(
    catalog as unknown as CatalogService,
    dataSource as unknown as DataSource,
  );
  return { service, manager, dataSource, catalog };
}

const play = (msPlayed: number): RecordPlayDto => ({
  playId: PLAY_ID,
  trackId: TRACK_ID,
  msPlayed,
  context: PlayContext.Album,
});

describe('requiredPlayMs', () => {
  it('is 30 s for long tracks and the whole track (minus 1 s of tolerance) for short ones', () => {
    expect(requiredPlayMs(180_000)).toBe(30_000);
    expect(requiredPlayMs(30_500)).toBe(29_500);
    expect(requiredPlayMs(12_500)).toBe(11_500);
    expect(requiredPlayMs(400)).toBe(0);
  });

  it('falls back to 30 s when the duration is unknown', () => {
    expect(requiredPlayMs(null)).toBe(30_000);
    expect(requiredPlayMs(0)).toBe(30_000);
  });
});

describe('HistoryService', () => {
  it('records a play of 30 s or more and increments playCount', async () => {
    const { service, manager } = setup();

    await expect(service.record('user-1', play(30_000))).resolves.toBe(true);

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
      'user-1',
      TRACK_ID,
      PLAY_ID,
      30_000,
      PlayContext.Album,
    ]);
    expect(manager.increment).toHaveBeenCalledWith(Track, { id: TRACK_ID }, 'playCount', 1);
  });

  it('rejects a play under 30 s with PLAY_TOO_SHORT and writes nothing', async () => {
    const { service, dataSource } = setup();

    const error: unknown = await service
      .record('user-1', play(29_999))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
      code: 'PLAY_TOO_SHORT',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('accepts a short track once it was played in full', async () => {
    const { service, manager } = setup(20_000);

    await expect(service.record('user-1', play(19_000))).resolves.toBe(true);
    await expect(service.record('user-1', play(18_999))).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(manager.increment).toHaveBeenCalledTimes(1);
  });

  it('does not count a repeated playId twice', async () => {
    const { service, manager } = setup(180_000, []);

    await expect(service.record('user-1', play(45_000))).resolves.toBe(false);

    expect(manager.increment).not.toHaveBeenCalled();
  });

  it('propagates 404 for a track that is not playable', async () => {
    const { service, catalog, dataSource } = setup();
    catalog.findReadyTrack.mockRejectedValue(new NotFoundException({ code: 'TRACK_NOT_FOUND' }));

    await expect(service.record('user-1', play(60_000))).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
