# Waven — MVP Specification

> Portfolio project: a music streaming web app. Scope sized for a single developer.
> Last updated: 2026-11-20.

## 1. Scope

**Included**
- Google login, session with JWT + refresh token, and an editable profile.
- Catalog of artists, albums and tracks, managed from an admin panel.
- Authenticated streaming with HTTP Range, in two qualities (128 and 320 kbps).
- Full player: queue, shuffle, repeat, volume, Media Session and keyboard shortcuts.
- Search, playlists, favorites and listening history.
- Free and Premium plans, with a Mercado Pago subscription (sandbox).

**Out of scope:** mobile apps, offline downloads, DRM, recommendations, social features (following users, public or shared playlists), commercially licensed music, real payments, lyrics, podcasts and a light theme (the tokens leave it ready).

## 2. Roles and plans

| | Free | Premium (ARS 2,999/month) |
|---|---|---|
| Own playlists | Up to 5 | Unlimited |
| Tracks per playlist | 500 | 500 |
| Streaming quality | Standard, 128 kbps | High, 320 kbps |
| Favorites and history | Yes | Yes |

- **user:** uses the app according to their plan.
- **admin:** can also manage the catalog and users and view metrics. The role is granted if the email is listed in `ADMIN_EMAILS` (at login) or from the admin panel.

## 3. User stories

**Account**
- US-01 As a visitor, I want to sign in with Google so I can start listening without creating a password.
- US-02 As a user, I want to view and edit my display name, and see my current plan.
- US-03 As a user, I want to sign out on this device.

**Catalog and playback**
- US-04 As a user, I want a home screen with new releases, the most played tracks and what I listened to recently.
- US-05 As a user, I want to see an artist page (albums and popular tracks) and an album page (track list).
- US-06 As a user, I want to play, pause, seek within the track, skip to the next one or go back, and adjust the volume from a fixed bar.
- US-07 As a user, I want to manage a queue (add, remove, reorder and see what is coming up), with shuffle and repeat (off, all or one).
- US-08 As a user, I want to control playback with the keyboard and with the operating system's media controls.
- US-09 As a Premium user, I want to listen in high quality automatically.

**Library**
- US-10 As a user, I want to search tracks, albums and artists with results as I type.
- US-11 As a user, I want to create, rename, describe and delete playlists, and add, remove and reorder tracks (with drag and drop).
- US-12 As a user, I want to mark tracks as favorites and see them together.
- US-13 As a user, I want to see my listening history.

**Billing**
- US-14 As a Free user, I want to upgrade to Premium by paying with Mercado Pago.
- US-15 As a Premium user, I want to see my subscription status and cancel it.
- US-16 As a Free user with 5 playlists, I want to see clearly why I cannot create another one and how to upgrade to Premium.

**Administration**
- US-17 As an admin, I want to create, edit and delete artists, albums (with cover art) and tracks (uploading the audio).
- US-18 As an admin, I want to see users, change their roles and see their subscriptions.
- US-19 As an admin, I want a dashboard with basic metrics: users, Premium users, plays per day and most played tracks.

## 4. Entities (PostgreSQL)

All of them have `id uuid`, `createdAt` and `updatedAt` unless stated otherwise.

| Entity | Key fields | Notes |
|---|---|---|
| **User** | googleId (unique), email (unique), displayName, avatarUrl, role (`user`\|`admin`) | The plan is **not** stored here: it is derived from Subscription. |
| **RefreshToken** | userId, tokenHash, familyId, expiresAt, revokedAt, userAgent | Rotation with reuse detection per family. |
| **Artist** | name, slug (unique), bio, imageKey | |
| **Album** | artistId, title, slug (unique per artist), releaseDate, coverKey, dominantColor (hex) | The color is computed on the server when the cover is uploaded. |
| **Track** | albumId, artistId, title, trackNumber, durationMs, audioKeyStd, audioKeyHigh, status (`processing`\|`ready`\|`failed`), playCount, source, license, attributionUrl, deletedAt | Soft delete. |
| **Playlist** | ownerId, name, description, coverKey (optional) | Always private in the MVP. |
| **PlaylistTrack** | id, playlistId, trackId, position, addedAt | A track can appear more than once; `position` is unique per playlist. |
| **Favorite** | userId + trackId (composite PK), createdAt | |
| **PlayHistory** | userId, trackId, playedAt, msPlayed, context (`album`\|`playlist`\|`search`\|…) | Index on `(userId, playedAt desc)`. |
| **Subscription** | userId, provider, mode (`preapproval`\|`onetime`), externalId, status (`pending`\|`authorized`\|`paused`\|`cancelled`), amount, currency, currentPeriodEnd, cancelledAt | Only one active per user. |
| **WebhookEvent** | provider, externalEventId (unique per provider), type, payload (jsonb), processedAt, error | Guarantees idempotency. |

## 5. API

Base: `/` on the API. The web reaches it as `/api/*` through a Next.js proxy. Swagger at `/docs`.
Authentication: `Bearer` with the access JWT unless stated otherwise. Lists are paginated with `?limit=&offset=` (max 50).

**Auth and profile**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/auth/google` | public | Starts OAuth. |
| GET | `/auth/google/callback` | public | Creates or updates the user, sets the refresh cookie and redirects to the web. |
| POST | `/auth/refresh` | cookie | Rotates the refresh token and returns `{ accessToken }`. |
| POST | `/auth/logout` | cookie | Revokes the token family and clears the cookie. |
| GET | `/me` | user | Profile + `plan` + current limits. |
| PATCH | `/me` | user | Updates `displayName`. |

**Catalog and streaming**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/browse/home` | user | Sections: new releases, popular, recently played. |
| GET | `/artists` · `/artists/:id` | user | Detail with albums and popular tracks. |
| GET | `/albums` · `/albums/:id` | user | Detail with tracks. |
| GET | `/tracks/:id` | user | |
| POST | `/tracks/:id/stream` | user | Returns `{ url, quality, expiresAt }`, a signed URL based on the plan. |
| GET | `/stream/:trackId?token=` | signed token | Audio with `Range` support (206). With S3 storage, it redirects (302) to a presigned URL. |
| GET | `/media/*` | public | Cover and artist images (in dev; in prod, a CDN or public bucket). |
| GET | `/search?q=&type=&limit=` | user | `type` = `track`\|`album`\|`artist`\|`all`. Returns `{ tracks, albums, artists, topResult }`; `limit` (1–20, default 10) applies per type. |

**Library**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/me/playlists` | user | |
| POST | `/playlists` | user | 403 `PLAN_LIMIT_REACHED` when the limit is exceeded. |
| GET · PATCH · DELETE | `/playlists/:id` | owner | |
| POST | `/playlists/:id/tracks` | owner | Takes `{ trackIds[], position? }`. |
| DELETE | `/playlists/:id/tracks/:entryId` | owner | |
| PATCH | `/playlists/:id/tracks/:entryId/position` | owner | Takes `{ position }`. |
| GET | `/me/favorites` | user | |
| GET | `/me/favorites/contains?ids=` | user | To render the hearts in a list. |
| PUT · DELETE | `/me/favorites/:trackId` | user | Idempotent. |
| POST | `/me/history` | user | Takes `{ playId, trackId, msPlayed, context }`; 204. Repeating a `playId` is a no-op. |
| GET | `/me/history?limit=&cursor=` | user | Newest play first, one entry per play. Returns `{ items, nextCursor }`. |

**Billing**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/billing/plans` | user | |
| POST | `/billing/checkout` | user | Returns `{ redirectUrl }`. |
| GET | `/billing/subscription` | user | |
| POST | `/billing/subscription/cancel` | user | |
| POST | `/webhooks/mercadopago` | MP signature | Validates `x-signature`, is idempotent and takes no JWT. |

**Administration** (`admin` role)
| Method | Path | Description |
|---|---|---|
| CRUD | `/admin/artists`, `/admin/albums`, `/admin/tracks` | Includes `POST /admin/albums/:id/cover` and `POST /admin/tracks/:id/audio` (multipart → transcoding). |
| GET · PATCH | `/admin/users`, `/admin/users/:id` | List, search and role change. |
| GET | `/admin/subscriptions` | List filterable by status. |
| GET | `/admin/stats` | Dashboard metrics. |

**Infrastructure:** `GET /health` (database and storage status).

## 6. Business rules

1. **Effective plan:** a user is Premium if they have a Subscription with `status = authorized` and `currentPeriodEnd > now`. Also if it is `cancelled` but `currentPeriodEnd` is still in the future: the user keeps access until the end of the paid period.
2. **Downgrade:** if a user goes back to Free with more than 5 playlists, they keep all of them and can edit and play them, but cannot create new ones until they have fewer than 5.
3. **Quality:** it is fixed when the stream token is issued (Free = std, Premium = high). The token lasts 1 h and is bound to the user, the track and the quality.
4. **History:** a play is recorded after ≥ 30 s of listening, or the full track if it is shorter. The client sends it once per play. "Recently played" shows tracks without repeats.
5. **playCount:** incremented on every valid history entry.
6. **Per-resource authorization:** playlists can only be seen and changed by their owner. If the resource belongs to someone else, the API returns **404** (not 403) so it does not reveal what exists.
7. **Catalog:** only tracks with `status = ready` and no `deletedAt` are exposed. A deleted track stays in playlists, marked as "unavailable".
8. **Subscription:**
   - A user can have only one `pending` or `authorized` subscription; checkout is rejected with 409 if one already exists.
   - When cancelling in preapproval mode, the subscription is also cancelled in Mercado Pago.
   - In onetime mode, each approved payment adds 30 days to `max(now, currentPeriodEnd)`.
9. **Webhook:**
   - An invalid signature returns 401.
   - Duplicate events return 200 and are not processed.
   - State is never taken from the payload: the resource is always fetched again from the Mercado Pago API.
   - Invalid state transitions are logged and ignored.
10. **Admin:** an admin cannot remove their own role. Audio uploads accept mp3, flac, wav and ogg up to 100 MB; cover uploads accept jpg, png and webp up to 5 MB.

## 7. Catalog and licensing

- **Catalog for the deployed demo:** imported from **Jamendo** with a configurable seed script (~300 tracks by default; it can scale to thousands) that accepts **all Creative Commons licenses**, including NC ones. They are compatible with a non-commercial demo as long as attribution is shown.
- **Attribution:** every track stores `license` and `attributionUrl`, and the UI shows them in the track details.
- **Local use with your own files:** the `catalog:import <folder>` script reads the ID3 tags of your own MP3s. It is for testing the app **locally only**; those files are never uploaded to any deployed environment.
- **Caveat:** uploading third-party copyrighted music to a public environment counts as distribution even if nothing is charged, and can trigger takedown notices on Render, Vercel or GitHub. The public demo uses CC content only.

## 8. Assumptions

- The end user pays for Premium: ARS 2,999 per month, with no trial period.
- The payment mode is selected with `PAYMENT_MODE=preapproval|onetime`. It starts with preapproval and switches to onetime (Checkout Pro, "Premium 30 days") if the sandbox proves unreliable.
- The Mercado Pago account (test users and webhook) is set up in the billing phase. `cloudflared` is used to receive webhooks locally.
- Deployment: web on Vercel, API on Render and managed PostgreSQL (Render or Neon). In production, audio and images go to Cloudflare R2: Render's disk is ephemeral on the free plan and R2 does not charge for egress. The 10 GB R2 free tier fits about 900 tracks in two qualities.
- The API on Render's free plan sleeps without traffic, so the first request can take about 50 s. The README warns about it.
- The UI is English only and dark theme only.
- The API is ESM (the NestJS 12 default): relative imports end in `.js`. Tests run on Vitest, the Nest 12 template default, instead of Jest.
- The API has no global route prefix: the web proxy strips `/api` (`/api/health` → `/health`), so Swagger lives at `/docs` on the API and `/api/docs` through the web.
- The TypeORM CLI runs against the compiled `dist`, because decorator metadata needs `tsc`. That is why the migration scripts build first.
- The Postgres host ports default to 5432 (dev) and 5433 (test), and can be overridden with `DB_PORT`/`DB_TEST_PORT` in the root `.env` when a local Postgres already uses them. `DATABASE_URL` and `TEST_DATABASE_URL` must use the same ports.
- ESLint stays on v9 until `eslint-plugin-react` (used by `eslint-config-next`) supports v10.
- Dependency versions are pinned exactly. pnpm's minimum release age is respected: releases published less than a day ago are not used.
- Refresh tokens are opaque random values stored only as SHA-256 hashes. Every refresh rotates the token and slides its 30-day expiry. Presenting a revoked token, or losing a race for the same token, revokes the whole family. Other devices (other families) stay signed in.
- The access JWT carries the role, so a role change applies at the next refresh (at most 15 min later).
- The web serializes refreshes across tabs with the Web Locks API, because the cookie jar is shared and a parallel refresh with the same cookie would look like token reuse.
- Cookies get the `Secure` flag only when `WEB_URL` is https, so local development works over plain http. The OAuth `state` is kept in a short-lived httpOnly cookie, because the API has no server-side sessions.
- `ADMIN_EMAILS` only grants the admin role at login; it never removes it.
- Until billing (phase 9) every user is on the Free plan, so `GET /me` always reports `free`.
- `GET /admin/users` (paginated list) is added in phase 1 to test the roles guard; phase 8 extends it with search and role changes.
- The global throttler is skipped when `NODE_ENV=test`, because every e2e request comes from the same IP.
- The OpenAPI export builds the Nest module graph in preview mode with fixed placeholder env vars, so it needs no database and its output does not depend on the developer's `.env`.
- The TypeORM CLI only needs `DATABASE_URL`, so migrations do not require the OAuth or JWT secrets. UUIDs use `gen_random_uuid()` (pgcrypto, built into Postgres 13+).
- Tracks get a fourth status, `pending`, while they have no audio yet (created from the admin panel before the upload). Only `ready` tracks are public.
- Artists and albums are only listed publicly when they have at least one `ready` track. Slugs are generated once at creation and do not change on rename.
- Catalog rows carry `source` (`upload`|`jamendo`|`local`) and `sourceId`, unique together, so the seed and `catalog:import` are idempotent.
- Deleting an artist with albums, or an album with any track (deleted ones included, since playlists still reference them), returns 409. Tracks are only soft-deleted.
- Uploaded originals are not kept: they are transcoded to 128 and 320 kbps CBR MP3 (stored under a new `audio/<uuid>/` prefix on each upload) and then deleted. Images are stored as WebP at 64, 300 and 640 px under `images/<uuid>/`.
- Transcoding jobs live in memory, so tracks still `processing` when the API starts are marked `failed` and must be uploaded again.
- The stream token is self-contained (HMAC-SHA256 over `{ userId, trackId, quality, exp }`), because `/stream` takes no JWT. "Another user's token" therefore means a token whose claims were altered (the signature fails) or one issued for a different track; both return 401.
- Stream URLs are built from `STREAM_BASE_URL` (the web proxy, `/api`, by default) and image URLs from `MEDIA_PUBLIC_URL`. `/media/*` only serves processed images, never audio.
- Only single `bytes` ranges are honored; multi-range or malformed `Range` headers get the full file (200), as RFC 9110 allows.
- "Recently played" on `/browse/home` is per user: the last 10 distinct public tracks, ordered by their latest play.
- The Jamendo seed takes the most popular tracks (`order=popularity_total`) in the `mp32` format and stores the license name (for example `CC BY-NC-SA 3.0`) and the Jamendo track page as `attributionUrl`.
- Design tokens live only in the `:root` block of `apps/web/src/app/globals.css`. shadcn/ui's semantic variables point at them; because shadcn uses `accent` for hover surfaces, Tailwind's `accent` maps to `--elevated` and the brand violet is exposed as `brand`. Focus is a global `:focus-visible` outline (2 px `--accent`, 2 px offset).
- Covers and artist images are plain responsive `<img>` elements (`srcSet` over the API's 64/300/640 px WebP files) instead of `next/image`, because the API already resizes them and the optimizer refuses private IPs in development.
- An album's `dominantColor` reaches the CSS only as the `--dominant-color` variable and only if it is a 6-digit hex color. Artists have no color of their own, so their header borrows the first album color the API returns.
- Catalog pages render on the client under `<Suspense>`: with Cache Components, route params and the pathname are request-time data. A malformed id or a 400/404 from the API shows a "not found" state; other errors show a retry button.
- Track details (license and attribution link) open in a popover from an info button on every track row.
- Premium is a "Coming soon" page until phase 9, so the navigation is complete from the start.
- The web runs unit tests with Vitest (the same version as the API) for pure helpers; component tests are not set up yet.
- When the session cannot be restored on load because the API is unreachable (network error or 5xx, including the web proxy's error), the web shows "We can't reach Waven right now" with a retry button instead of signing the user out. Only 4xx answers from `/auth/refresh` sign the user out. A failed refresh while already signed in keeps the current state, and each query shows its own error.
- `POST /me/history` takes a client-generated `playId` (one per play), unique per user, so retries never count a play twice; it answers 204 either way. A play shorter than the threshold gets 422 `PLAY_TOO_SHORT`.
- The "whole track" threshold for tracks under 30 s allows 1 s of tolerance (`durationMs − 1000`), because the browser's playback clock and the duration read from the encoded file differ by a few frames. A track with an unknown duration needs 30 s.
- `PlayHistory.context` is one of `album`, `artist`, `playlist`, `search`, `home`, `favorites` or `other`. History rows are immutable, so `playedAt` replaces `createdAt`/`updatedAt`.
- The client counts only time actually listened (seeks do not add to it) and reports once per play, retrying once after 5 s on a network or 5xx error.
- The audio engine calls `POST /tracks/:id/stream` and `POST /me/history` directly through the typed client, not through TanStack Query: they are imperative playback commands with their own token cache, not server state shown by the UI.
- Stream tokens are renewed when they have less than 60 s left before playing, and once more if the browser reports a source error mid-track (an expired token); a second failure shows "This track could not be played" and pauses.
- The player persists the queue, play order, current track, shuffle, repeat, volume and mute in `localStorage` (`waven-player`). The playback position is not persisted: after a reload the current track starts paused from 0. A corrupted saved queue is discarded.
- When the queue ends with repeat off, the player goes back to the first track, paused. "Previous" restarts the current track after 3 s of playback; from the first track it wraps only with repeat all. Repeat one replays the track when it ends, but "Next" still moves on.
- Shuffle keeps the current track and shuffles the rest after it (Fisher–Yates), so a pass never repeats a track; turning it off returns to the original order at the same track. With repeat all, the shuffled order is kept for the next pass.
- Reordering the queue with shuffle off moves the tracks themselves (the original order follows the user); with shuffle on it moves the shuffled order.
- Keyboard shortcuts: Space (play/pause), ←/→ (seek 5 s), Shift+←/→ (previous/next), M (mute), S (shuffle), R (repeat). They are ignored in text fields and with Ctrl/Meta/Alt; Space is left to focused buttons and links, and arrows to focused sliders. Mode changes are announced in a live region. The OS media controls seek 10 s by default.
- The queue view is a `/queue` page (linked from the player bar and the full-screen player) instead of a side panel; it is reorderable by drag and drop and by keyboard (`@dnd-kit`).
- OS media controls go through the Media Session API. Windows routes the media keys to a single media session, so another app or tab playing media (YouTube in another browser, Spotify) can take them; this is OS behavior, not a player bug.
- Playlist positions are 0-based and contiguous. `UNIQUE (playlistId, position)` is `DEFERRABLE INITIALLY DEFERRED`, so a transaction can shift a range of positions. Every track change locks the playlist row (`SELECT … FOR UPDATE`), so concurrent edits from two tabs apply one after another. Positions past the end are clamped to the end.
- Reorders and removals address entries by `entryId` (a track may repeat), never by track id. They answer with the whole playlist, which the web takes as the new state.
- `POST /playlists` takes an optional name (default "My Playlist #n", where n is the number of owned playlists + 1) and description. Creations lock the user row, so parallel requests cannot get past the plan limit.
- A playlist over 500 tracks gets 409 `PLAYLIST_FULL`. Adding a track that is not playable gets 404 `TRACK_NOT_FOUND`, and nothing is added. One request adds up to 100 tracks.
- Playlist errors use stable codes: `PLAYLIST_NOT_FOUND` (also for someone else's playlist) and `ENTRY_NOT_FOUND`.
- Playlists have no cover upload in the MVP: the API returns up to 4 distinct album covers in playlist order, and the web shows one cover or a 2×2 mosaic. `coverKey` stays reserved.
- `GET /me/playlists` lists the newest first. The sidebar and the "Add to playlist" menu show the first 50 (the page size cap).
- Favorites and playlists keep deleted tracks and return them with `available: false`. The web shows them dimmed and the player skips them. Only playable tracks can be liked; any track can be unliked.
- `GET /me/favorites/contains?ids=` takes up to 50 comma-separated ids (`ids=a&ids=b` also works). The web asks once per list, in chunks of 50.
- Hearts, reorders and removals are optimistic (TanStack Query) and roll back on error. A server answer is applied only when no other edit of the same playlist is still in flight. Other tabs refetch through a `BroadcastChannel` (`waven-library`), on top of the refetch on focus.
- The track context menu is the row's "More options" button, which right-clicking the row also opens. It offers "Add to playlist" (an existing playlist or "New playlist") and, on playlist pages, "Remove from this playlist".
- Liked Songs lives at `/favorites` and playlists at `/playlists/:id`; both count as Library pages for the navigation. Liked Songs loads 50 tracks at a time with "Show more", and its play button plays the tracks loaded so far.
- The upgrade prompt (US-16) opens when `POST /playlists` answers `PLAN_LIMIT_REACHED`. It links to `/premium`, a "Coming soon" page until phase 9.
- The sidebar library hydrates after the session is restored, so it first renders without playlists (as the server did) to avoid a hydration mismatch.
- `PaginationQueryDto` declares `limit` and `offset` as integers in OpenAPI, so the generated client types them as numbers.
- Search compares `f_unaccent(lower(column))`, the expression the GIN trigram indexes are built on. `unaccent()` is not immutable, so the migration adds an immutable `f_unaccent()` wrapper. Tracks match on their title, albums on their title and artists on their name.
- A hit is a substring match (`LIKE`, with wildcards in the query escaped) or a fuzzy word match (`<%`), with `pg_trgm.word_similarity_threshold` set to 0.5 for each search transaction. The default of 0.6 misses one-letter typos in short words.
- Hits are ranked by `word_similarity`, plus a bonus for an exact match (1), a prefix match (0.5) or a substring match (0.25). Ties go to the most played track, the newest album, or the artist name in A–Z order.
- `topResult` is the best hit across types and is only returned with `type=all`. On a tie, artists win over albums and albums over tracks. A blank `q` returns empty lists, and a missing or too long `q` (over 100 characters) gets 400.
- `GET /me/history` uses keyset pagination over `(playedAt, id)`, and `nextCursor` is the id of the last entry. A play recorded while paging never shifts a page, so no entry shows up twice. An unknown cursor, or someone else's, returns an empty page. Deleted tracks stay in the history with `available: false`.
- The web search page keeps `?q=&type=` in the URL, which is the source of truth. The input writes to it 250 ms after the last keystroke with `router.replace`, so typing does not fill the back stack. The previous results stay on screen, dimmed, while the next ones load. "All" shows up to 6 hits per type and 4 songs next to the top result; a single type shows up to 20.
- Playing the top song queues the other song results after it. Search plays use the `search` context; replays from the history page use `other`.
- The listening history lives at `/history`, which counts as a Library page. It is grouped by local day, loads 50 plays at a time with "Show more", and is linked from Home ("Show all") and from the Library grid.
- After the API accepts a play, the web invalidates the history list and Home, so "Recently played" updates without a reload.
- The p95 search target is measured on the API over HTTP: 280 searches on the 300-track seeded catalog took 12 ms at p95 (8 ms at p50). Each SQL lookup takes about 3 ms at p95.
