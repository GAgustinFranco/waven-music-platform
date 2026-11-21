import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { type TrackStatus } from '../catalog/entities/track.entity.js';
import { type AdminStatsDto, type TrackStatsDto } from './admin-stats.dto.js';

const TOP_TRACKS = 5;

interface UserCounts {
  total: number;
  admins: number;
  premium: number;
  new_last_7_days: number;
}

interface TopTrackRow {
  id: string;
  title: string;
  play_count: number;
  artist_id: string;
  artist_name: string;
  artist_slug: string;
}

/** Read-only aggregates for the admin dashboard, computed with plain SQL. */
@Injectable()
export class AdminStatsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async get(days: number): Promise<AdminStatsDto> {
    const [users, tracks, playsPerDay, topTracks] = await Promise.all([
      this.userCounts(),
      this.trackCounts(),
      this.playsPerDay(days),
      this.topTracks(),
    ]);
    return { users, tracks, playsPerDay, topTracks };
  }

  private async userCounts(): Promise<AdminStatsDto['users']> {
    // Premium follows business rule 1: authorized, or cancelled with time left.
    const [row] = await this.db.query<UserCounts[]>(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE u.role = 'admin')::int AS admins,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s.user_id = u.id
             AND s.status IN ('authorized', 'cancelled')
             AND s.current_period_end > now()
         ))::int AS premium,
         count(*) FILTER (WHERE u.created_at > now() - interval '7 days')::int AS new_last_7_days
       FROM users u`,
    );
    return {
      total: row?.total ?? 0,
      admins: row?.admins ?? 0,
      premium: row?.premium ?? 0,
      newLast7Days: row?.new_last_7_days ?? 0,
    };
  }

  private async trackCounts(): Promise<TrackStatsDto> {
    const rows = await this.db.query<{ status: TrackStatus; count: number }[]>(
      `SELECT status, count(*)::int AS count FROM tracks WHERE deleted_at IS NULL GROUP BY status`,
    );
    const counts: TrackStatsDto = { total: 0, pending: 0, processing: 0, ready: 0, failed: 0 };
    for (const { status, count } of rows) {
      counts[status] = count;
      counts.total += count;
    }
    return counts;
  }

  /** The last `days` UTC days ending today, with zeros for days without plays. */
  private playsPerDay(days: number): Promise<AdminStatsDto['playsPerDay']> {
    return this.db.query<AdminStatsDto['playsPerDay']>(
      `WITH bounds AS (SELECT (now() AT TIME ZONE 'UTC')::date AS today)
       SELECT to_char(day, 'YYYY-MM-DD') AS date, count(h.id)::int AS plays
       FROM bounds,
         generate_series(bounds.today - ($1::int - 1), bounds.today, interval '1 day') AS day
       LEFT JOIN play_history h
         ON h.played_at >= day AT TIME ZONE 'UTC'
        AND h.played_at < (day + interval '1 day') AT TIME ZONE 'UTC'
       GROUP BY day
       ORDER BY day`,
      [days],
    );
  }

  private async topTracks(): Promise<AdminStatsDto['topTracks']> {
    const rows = await this.db.query<TopTrackRow[]>(
      `SELECT t.id, t.title, t.play_count, a.id AS artist_id, a.name AS artist_name,
              a.slug AS artist_slug
       FROM tracks t
       JOIN artists a ON a.id = t.artist_id
       WHERE t.deleted_at IS NULL AND t.play_count > 0
       ORDER BY t.play_count DESC, t.id
       LIMIT $1`,
      [TOP_TRACKS],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      playCount: row.play_count,
      artist: { id: row.artist_id, name: row.artist_name, slug: row.artist_slug },
    }));
  }
}
