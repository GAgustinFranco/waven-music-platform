# Waven — MVP Specification

> Portfolio project: a music streaming web app. Scope sized for a single developer.
> Last updated: 2026-11-20.

## 1. Scope

**Included**
- Google login or email and password, session with JWT + refresh token, and an editable profile.
- Catalog of artists, albums and tracks, managed from an admin panel.
- Authenticated streaming with HTTP Range at 320 kbps on every plan.
- Transactional emails: a welcome (with a one-click verification link for password accounts) and a Premium welcome.
- Full player: queue, shuffle, repeat, volume, Media Session and keyboard shortcuts.
- Search, playlists, favorites and listening history.
- Free and Premium plans, with a Mercado Pago subscription (sandbox).

**Out of scope:** mobile apps, offline downloads, DRM, recommendations, social features (following users, public or shared playlists), commercially licensed music, real payments, lyrics, podcasts and a light theme (the tokens leave it ready).

## 2. Roles and plans

| | Free | Premium (ARS 2,999/month) |
|---|---|---|
| Own playlists | Up to 5 | Unlimited |
| Tracks per playlist | 500 | 500 |
| Streaming quality | High, 320 kbps | High, 320 kbps |
| Themes and backdrops | Default only | All |
| Favorites and history | Yes | Yes |

- **user:** uses the app according to their plan.
- **admin:** can also manage the catalog and users and view metrics. The role is granted if the email is listed in `ADMIN_EMAILS` (at login) or from the admin panel.

## 3. User stories

**Account**
- US-01 As a visitor, I want to sign in with Google so I can start listening without creating a password.
- US-01b As a visitor without a Google account, I want to create an account with my email and a password, and sign in with them later.
- US-02 As a user, I want to view and edit my display name, and see my current plan.
- US-03 As a user, I want to sign out on this device.

**Catalog and playback**
- US-04 As a user, I want a home screen with new releases, the most played tracks and what I listened to recently.
- US-05 As a user, I want to see an artist page (albums and popular tracks) and an album page (track list).
- US-06 As a user, I want to play, pause, seek within the track, skip to the next one or go back, and adjust the volume from a fixed bar.
- US-07 As a user, I want to manage a queue (add, remove, reorder and see what is coming up), with shuffle and repeat (off, all or one).
- US-08 As a user, I want to control playback with the keyboard and with the operating system's media controls.
- US-09 As a user, I want to listen in high quality automatically, whatever my plan.

**Library**
- US-10 As a user, I want to search tracks, albums and artists with results as I type.
- US-11 As a user, I want to create, rename, describe and delete playlists, and add, remove and reorder tracks (with drag and drop).
- US-12 As a user, I want to mark tracks as favorites and see them together.
- US-13 As a user, I want to see my listening history.

**Billing**
- US-14 As a Free user, I want to upgrade to Premium by paying with Mercado Pago.
- US-15 As a Premium user, I want to see my subscription status and cancel it.
- US-16 As a Free user with 5 playlists, I want to see clearly why I cannot create another one and how to upgrade to Premium.
- US-16b As a Premium user, I want to pick a color theme and backdrop for the app, including one that follows the album playing.

**Administration**
- US-17 As an admin, I want to create, edit and delete artists, albums (with cover art) and tracks (uploading the audio).
- US-18 As an admin, I want to see users, change their roles and see their subscriptions.
- US-19 As an admin, I want a dashboard with basic metrics: users, Premium users, plays per day and most played tracks.

## 4. Entities (PostgreSQL)

All of them have `id uuid`, `createdAt` and `updatedAt` unless stated otherwise.

| Entity | Key fields | Notes |
|---|---|---|
| **User** | googleId (unique, nullable), passwordHash (nullable), email (unique), emailVerifiedAt (nullable), emailVerificationTokenHash (unique, nullable), emailVerificationExpiresAt (nullable), displayName, avatarUrl, role (`user`\|`admin`) | The plan is **not** stored here: it is derived from Subscription. A check constraint requires a Google id or a password. |
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
| **Notification** | userId (cascade), type (`welcome`|`premium-activated`), data (jsonb, nullable), dedupKey (unique per user), readAt (nullable), createdAt | No `updatedAt`. Index on `(userId, createdAt, id)`. |

## 5. API

Base: `/` on the API. The web reaches it as `/api/*` through a Next.js proxy. Swagger at `/docs`.
Authentication: `Bearer` with the access JWT unless stated otherwise. Lists are paginated with `?limit=&offset=` (max 50).

**Auth and profile**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/auth/google` | public | Starts OAuth. |
| GET | `/auth/google/callback` | public | Creates or updates the user, sets the refresh cookie and redirects to the web. |
| POST | `/auth/register` | public + CSRF header | `{ email, password, displayName }` → 201 `{ accessToken }` and the refresh cookie. 409 `EMAIL_IN_USE`. |
| POST | `/auth/verify-email` | public | `{ token }` from the welcome email → 204 and the email is verified; the token is consumed. 400 `EMAIL_VERIFICATION_INVALID` if it is unknown, used or expired. |
| POST | `/auth/login` | public + CSRF header | `{ email, password }` → `{ accessToken }` and the refresh cookie. 401 `INVALID_CREDENTIALS`. |
| POST | `/auth/refresh` | cookie | Rotates the refresh token and returns `{ accessToken }`. |
| POST | `/auth/logout` | cookie | Revokes the token family and clears the cookie. |
| GET | `/me` | user | Profile + `plan` + current limits. |
| PATCH | `/me` | user | Updates `displayName`, `theme` and `backdrop`; a theme or backdrop other than the default needs Premium (403 `PREMIUM_REQUIRED`). |

**Catalog and streaming**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/browse/home` | user | Sections: new releases, popular, recently played. |
| GET | `/browse/showcase` | public | `{ covers }`: up to 48 random public album covers for the sign-in page. |
| GET | `/artists` · `/artists/:id` | user | Detail with albums and popular tracks. |
| GET | `/albums` · `/albums/:id` | user | Detail with tracks. |
| GET | `/tracks/:id` | user | |
| POST | `/tracks/:id/stream` | user | Returns `{ url, quality, expiresAt }`, a signed URL (`high` on every plan). |
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

**Notifications**
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/notifications?limit=&cursor=` | user | Newest first. Returns `{ items, nextCursor, unreadCount, reminders }`; `unreadCount` and `reminders` cover the whole account. |
| PATCH | `/notifications/:id/read` | owner | Returns the notification; idempotent. Someone else's or unknown → 404 `NOTIFICATION_NOT_FOUND`. |
| POST | `/notifications/read-all` | user | 204; marks every notification of the caller read. |

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
3. **Quality:** it is fixed when the stream token is issued, from the plan's limits (every plan = high, 320 kbps). The token lasts 1 h and is bound to the user, the track and the quality.
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
- `GET /me`, the playlist limit and the stream quality all read the effective plan (business rule 1) from `PlanService`, the single place that derives it from the subscriptions.
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
- `/premium` compares Free and Premium with the prices from `GET /billing/plans` and starts the checkout.
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
- The upgrade prompt (US-16) opens when `POST /playlists` answers `PLAN_LIMIT_REACHED`. It links to `/premium`.
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
- The profile and plan page lives at `/profile` and is linked from the account menu. It edits the display name (trimmed, 1–50 characters, mirroring `UpdateMeDto`) and shows the plan, its limits and the playlists in use ("3 of 5"), counted from `GET /me/playlists` (`total`), so the API needed no changes. Free users see a link to `/premium`.
- Confirmations and mutation errors are toasts (`sonner`, the shadcn/ui toast) placed above the player bar or mini player, replacing the library's own status line. Form validation errors stay inline.
- Transitions use `motion` under `MotionConfig reducedMotion="user"`: pages fade and rise in through `app/(app)/template.tsx`, and the heart pops when a song is liked. Under `prefers-reduced-motion` the transforms are dropped (pages only fade), the global CSS rule cuts CSS animations and transitions, and the empty-state art only floats with `motion-safe`.
- Empty states share one illustration (a disc on sound waves in the brand gradient, with the state's icon) drawn as inline SVG with tokens only, at a fixed size so it never shifts the layout.
- Hovering (not touch) or focusing a link to an album, artist or playlist prefetches its detail query (`PrefetchLink`); Next already prefetches the route code.
- Contrast review: every text token passes AA on every surface (`--accent` on `--elevated` is the lowest, 4.58:1). Form fields use a new `--border-strong` (`#70708A`, ≥ 3:1 on every surface, WCAG 1.4.11); `--border` stays for decorative dividers. Stale search results dim to 75% instead of 60%, so muted text keeps 4.5:1.
- CLS is checked in the dev preview with a buffered `PerformanceObserver` on full loads of Home, search, library, Liked Songs, history, profile, album, artist and playlist pages: every page scored 0 to 0.0001. Reduced motion was checked by forcing `matchMedia('(prefers-reduced-motion: reduce)')` in a same-origin frame, because the preview cannot emulate the media feature.
- The `Subscription` table (SPEC §4) is created in phase 8, so `/admin/subscriptions` and the Premium count in `/admin/stats` work now; checkout, webhooks and the state machine arrive in phase 9. A partial unique index enforces one `pending` or `authorized` subscription per user. `amount` is `numeric(12,2)` in major units (ARS 2999.00).
- An admin changing their own role gets 409 `CANNOT_DEMOTE_SELF`; setting the current role is a no-op. Demoting another admin is allowed. The new role reaches that user's access token at the next refresh (at most 15 minutes later).
- Admin lists take `q`, a case-insensitive substring match with `%` and `_` escaped: users by email or display name, subscriptions by the owner's email or name, artists by name, albums and tracks by title. `/admin/users` also filters by `role` and `/admin/subscriptions` by `status`.
- `/admin/stats?days=1..90` (default 14) returns user counts (total, admins, Premium per business rule 1, new in the last 7 days), track counts by status (deleted excluded), plays per UTC day with zeros filled in, and the 5 tracks with the highest all-time `playCount`.
- The admin panel lives in its own `(admin)` route group without the player. `AdminGate` checks the role from `/me` and sends anyone else to `/`; the pages still render hidden, so they keep a static shell, but they fetch nothing until the role is confirmed. The API enforces the role on every `/admin/*` route.
- Albums are edited on `/admin/albums/:id` (details, cover and the track list with audio uploads). The tracks page lists every track and links to its album. Uploads use `XMLHttpRequest` because `fetch` cannot report upload progress, and the client checks the type and size before uploading (the API still checks the magic bytes). A `processing` track is polled every 1.5 s; when it settles, the admin lists and the public catalog queries are invalidated.
- Dashboard charts are plain HTML and CSS (no chart library): a single-series column chart of plays per day with a tooltip on hover or focus and a table view, and bars for the most played tracks.
- In the dev preview, the "user cannot open `/admin`" check stubbed `/api/me` to return `role: user` in the page, because the preview has a single Google account; the API side is covered by e2e tests (403 on every admin route).
- Both payment providers are always registered. `PAYMENT_MODE` only picks the one used by new checkouts; a subscription is cancelled through the provider of its own `mode`, and a webhook goes to the provider that reads its `type` (`subscription_preapproval` and `subscription_authorized_payment` for preapproval, `payment` for Checkout Pro). An update read by the provider of the other mode is ignored, because the monthly charges of a preapproval also arrive as `payment` notifications.
- Mercado Pago is called with `fetch` over its REST API instead of the official SDK: four endpoints do not justify the dependency, and the provider interface is what the tests fake.
- Webhooks are set up in the Mercado Pago panel (events: Payments, and Plans and subscriptions), not with a per-checkout `notification_url`, so each event arrives once and always signed.
- Mercado Pago only accepts a public https `back_url`, so checkouts return to `<MP_PUBLIC_URL>/api/billing/return` (a tunnel in dev), and that public API route redirects to `<WEB_URL>/billing/return`, where the session cookie lives.
- In the sandbox, the payer must be the test buyer, so `MP_TEST_PAYER_EMAIL` replaces the user's email in the checkout when it is set. Without `MP_ACCESS_TOKEN`, checkout answers 503 `BILLING_UNAVAILABLE`; without `MP_WEBHOOK_SECRET`, every webhook gets 401.
- The webhook signature uses the `data.id` query parameter (lowercased when alphanumeric), `x-request-id` and `ts` from `x-signature`. `ts` is accepted in seconds or milliseconds, within 10 minutes of the API clock.
- The idempotency key is the notification's `id` (or `x-request-id` when it has none), unique per provider in `webhook_events`. If fetching the resource or applying it fails, the error is stored, the API answers 503 and Mercado Pago's retry processes the event again; only processed events count as duplicates. Unknown types and resources that do not exist or are not ours (simulated notifications) get 200 and change nothing.
- A preapproval's paid period ends at its `next_payment_date` while it is authorized; a cancelled one keeps the last period. Paused subscriptions are Free.
- A paused subscription also blocks a new checkout (409 `SUBSCRIPTION_EXISTS`), since it can resume; a pending checkout can be cancelled from the profile, so an abandoned checkout never locks the user out.
- In onetime mode, an approved payment extends the period by 30 days and is remembered in `subscriptions.last_payment_id`, so `payment.created` and `payment.updated` never count it twice. Pending, in-process and rejected payments change nothing (the buyer can retry on the same preference). Refunds and chargebacks cancel the pass and end access at once. Cancelling expires the preference, and a pass whose 30 days ran out is closed (`cancelled`) when the user starts a new checkout.
- If the provider fails while creating a checkout, the pending row is deleted and the API answers 502 `PAYMENT_PROVIDER_ERROR`, so the user can try again.
- `GET /billing/subscription` returns the effective plan and the newest subscription, whatever its status. `/billing/return` polls it every 2 s until the subscription leaves `pending` or the plan becomes Premium, and after 60 s says the confirmation may arrive later.
- Premium users see a "Premium" badge next to the account menu, linking to their profile, where the subscription card shows its status and lets them cancel it.
- A late or lost webhook does not leave the user waiting: while the newest subscription is `pending`, `GET /billing/subscription` reads its state from Mercado Pago (the preapproval, or an approved payment searched by external reference) and applies it through the same state machine. State still never comes from the client or the payload.
- A user whose subscription is cancelled but still running can subscribe again ("Subscribe again" on `/premium`). In onetime mode the new pass starts where the running one ends (its pending row carries that end, which grants nothing until a payment is approved), so no paid day is lost.
- Premium themes (phase 9b) only swap color tokens: each theme is a `[data-theme="…"]` block in `globals.css` next to `:root`, set on `<html>` for the app and on any element for the picker previews (so the shadcn mapping is declared again there). Type, spacing, radii and layout are shared. Every theme keeps text and accent at 4.5:1 or more on its surfaces.
- Themes: Midnight Violet (default, the only one on Free), Dynamic, Deep Ocean, Ember, Rose Noir, Aurora, Sunset and Studio Mono. Backdrops: Solid (default), Soft glow, a faint radial light in the theme's color behind the content, and Ambient, three blurred lights in the theme's colors (`--accent`, `--accent-2`, `--glow`) drifting slowly behind the content. Ambient breathes a little while music plays, only animates transforms, and stands still under `prefers-reduced-motion`; with Dynamic it follows the cover through the tokens. An "album tint" backdrop was dropped because it overlapped with Dynamic.
- The choice is stored on the user (`theme`, `backdrop`). `GET /me` returns `appearance` (what the app shows: the default on Free) and `savedAppearance` (the stored choice, kept after a downgrade so it comes back with Premium). A Free user may always save the default; anything else answers 403 `PREMIUM_REQUIRED`.
- Dynamic derives the whole palette from the cover playing. The web reads the 64 px cover into a 32×32 canvas and picks its most vibrant representative hue: pixels vote for one of 24 hue bins, weighted by saturation and by how far they are from black or white (dark tones such as a burgundy still count); pixels under 12% saturation are ignored. Surfaces, borders and muted text become very dark tints of that hue, the accent is a vivid version of it raised until it reaches 4.5:1, and the glow is stronger than in the fixed themes. A grayscale cover gives a silver theme; an unreadable image (no CORS on a CDN) falls back to `AlbumRefDto.dominantColor`; an empty player keeps Midnight Violet. Colors are cached per cover URL and the palette is registered with `@property`, so it fades over 700 ms between songs (instantly under `prefers-reduced-motion`).
- The last appearance is cached in `localStorage` (`waven-appearance`) and applied before `/me` loads, so a reload does not flash the default; `/me` always wins. The admin panel and the login page keep the default look.
- The full-screen player (mobile sheet) is tinted with the cover's color on every plan, as music apps usually do; choosing the app's colors is what Premium adds.
- Buttons share one interaction model: pointer cursor, a 150 ms eased transition and a 0.97 press scale. Brand buttons brighten with a soft accent glow on hover; neutral ones (outline, ghost, icon) get a translucent foreground overlay, so the hover shows on any surface and theme. The main play buttons also grow slightly (scale 1.05). Menu items highlight with a foreground overlay and an accent icon (the popover is `--elevated`, so the old `--elevated` highlight was invisible); the avatar button shows an accent ring; navigation items tint their icon with the accent. Profile cards are not interactive, so they only show a faint border and shadow on hover or while a field inside has focus, and never move.
- Email and password accounts sit next to Google sign-in. Passwords are hashed with Node's built-in `crypto.scrypt` (N=2^15, r=8, p=3, a 16-byte random salt, stored as `scrypt$N$r$p$salt$key` so the cost can be raised later) and compared in constant time. Passwords are 8 to 128 characters with no composition rules (NIST SP 800-63B); they are NFKC-normalized before hashing and never trimmed. Emails are trimmed and lowercased.
- `POST /auth/register` and `POST /auth/login` reuse the session of the Google flow (15 min access JWT and the rotating refresh cookie), the strict auth throttler (10/min per IP and route) and the CSRF check of `/auth/refresh` (`X-Requested-With` and a trusted `Origin`), because they set cookies too. `ADMIN_EMAILS` grants admin at sign-up and at every password login.
- A failed login always answers 401 `INVALID_CREDENTIALS` ("Invalid email or password"), whether the email is unknown, the password is wrong or the account only has Google; an unknown email still runs a scrypt hash so the timing does not tell them apart. Sign-up has to say 409 `EMAIL_IN_USE` for a taken email, which reveals that it exists; without email verification this cannot be avoided, and the throttler limits it.
- Accounts are never merged silently. Signing up with the email of a Google account answers 409. Google sign-in with the email of a password-only account takes that account over: Google proves the email and our sign-up does not, so the password is removed and every session of the account is revoked. Otherwise someone could register a victim's email first and keep access after the real owner signs in with Google.
- Out of scope for the MVP: password reset, changing the password, resending the verification link, requiring a verified email for anything, and adding a password to a Google account (or the reverse) from the profile.
- The sign-in page shows one of three interactive cover backdrops, picked at random on each visit (`?backdrop=wall|mosaic|float` forces one): a tilted 3D wall of scrolling columns with a mouse spotlight, a grayscale mosaic that lights up around the mouse and sends a wave on click, and covers floating in three parallax layers over an aurora. They are inspired by Aceternity UI, Magic UI and React Bits, written in-house with CSS and `requestAnimationFrame` (no new dependency). Without a mouse they animate on their own; under `prefers-reduced-motion` they stand still. They are decorative (`aria-hidden`) and only render in the browser, so the random pick never mismatches the server HTML.
- The covers come from the public `GET /browse/showcase`: random albums that are public anyway (at least one ready track), with a cover, from the Jamendo seed or admin uploads only. The local `catalog:import` is never shown there, because it may hold copyrighted art. Without covers (API down, empty catalog) the backdrops keep their shape with empty tiles.
- Home opens with a hero: a local greeting with the user's first name, a line and up to three album chips (the albums played last, or new releases when there is no history), over an animated cover backdrop. Five designs take turns, one per visit to Home: the tilted wall, a grayscale mosaic of sideways rows that lights up around the mouse, covers floating over an aurora, a slowly turning 3D ring and a record sliding out of its sleeve (the album playing, spinning while music plays). Order: wall, mosaic, float, flow, vinyl; the first visit starts at random and the last design is kept in `sessionStorage`, so a reload also moves on and the same design never shows twice in a row (`?hero=…` forces one). Next keeps Home mounted but hidden while the user is elsewhere, so the pick runs in an effect, which re-runs on every visit. The covers come from `GET /browse/showcase` as on the sign-in page. The backdrop is masked rather than covered with `--bg`, so it fades into Solid, Soft glow or Ambient; on phones it stays in the top half and the text sits below it. It pauses off screen and stands still under `prefers-reduced-motion`.
- Google sign-in on that page is a round button with only the "G" mark, named "Continue with Google" for assistive technology. The mark keeps Google's four brand colors, the only colors outside the design tokens.
- Audio quality is no longer a plan difference: `PLAN_LIMITS` gives `streamQuality: high` to Free too. The `std` quality, its 128 kbps file and the token claim stay, so tokens issued before the change keep working and the difference can come back without a migration. Plan limits also carry `themes` (Premium only), and the web lists plan benefits from those limits.
- Email goes through a `MailDriver`, like `StorageDriver`: `log` in dev (it only logs the subject, a masked recipient and, outside production, the links), `memory` in tests and `resend` in production (Resend's HTTP API through `fetch`, so no SDK dependency). `MAIL_DRIVER`, `MAIL_FROM` and `RESEND_API_KEY` are validated at startup; the key is required only with `resend`. Mailpit was not added: the log driver is enough to open the links in dev.
- Sending never blocks or fails a request: `MailService.send` is fire-and-forget and only logs the template name and the error message, never the recipient, the content or a token. Templates are single-column HTML with inline styles, `lang="en"` and every link also printed as text, plus a plain-text version.
- Every new account gets one welcome email. Password accounts get a one-click link in it: 32 random bytes (base64url) of which only the SHA-256 is stored on the user, valid for 24 hours and single use (one `UPDATE` checks the hash and the expiry and clears it). A new sign-up has one pending token at a time; there is no resend. Google accounts count as verified at the first sign-in (and the migration marks existing Google accounts verified); a Google takeover of a password account verifies it and clears its token.
- The link opens `/verify-email?token=…` on the web, which works with or without a session and posts the token to `POST /auth/verify-email`. A GET link on the API would be used up by mail scanners that open links. The page drops the token from the address bar and sends no referrer. Verification is informational for now: nothing requires it, and it is not exposed in `/me`.
- The Premium welcome is sent when a subscription goes from `pending` to `authorized`, after the transaction commits, whether the webhook or the pending sync applied it. The row lock and the state machine (nothing returns to `pending`) make that happen once per subscription, so webhook retries and duplicates never send it twice, and resuming a paused subscription sends nothing. In `onetime` mode each new 30-day pass is a new subscription, so each purchase gets its own welcome.
- In-app notifications mirror the transactional emails in a bell in the app header. The API stores and returns only a `type` and its `data`; the web owns the English copy and the links (welcome → Home, Premium → profile, where the plan is shown).
- "Verify your email" is a reminder derived on every read (a password account with `emailVerifiedAt IS NULL`), not a stored row: `emailVerifiedAt` stays the single source of truth, verifying resolves it with nothing else to update, existing unverified accounts get it without a backfill, and it can never go stale. Reminders come in a separate `reminders` list, cannot be marked read and count toward the badge while active.
- "You're on Premium" (`premium-activated`) is written by `BillingService.applyUpdate` in the same transaction that moves a subscription from `pending` to `authorized`, with `dedupKey = premium-activated:<subscriptionId>`. The row lock and the state machine already make that happen once; the unique `(userId, dedupKey)` and `INSERT … ON CONFLICT DO NOTHING` back it up against webhook retries, duplicates and the pending-sync race. If the activation rolls back, so does the notification.
- A welcome notification (`dedupKey = welcome`) is stored for every new account, Google or password, next to the welcome email, so the bell is never empty for a new user. Like the email, it never fails a sign-up: a storage error only logs. Accounts created before this feature get none.
- Opening the bell marks nothing as read, so the badge keeps meaning "something new". A notification is read when it is clicked (it then opens its link and the popover closes), or all at once with "Mark all as read". The badge counts unread notifications plus active reminders and shows "9+" above nine.
- The web refetches notifications every 60 s while the app is open and on window focus (30 s stale time); there are no push or websocket updates in the MVP. The list pages with a keyset cursor like the history (20 per page, "Show older").
- Album, artist, playlist and Liked Songs headers react to the app's content scroll (the shell's single scroll container, shared through `AppScrollArea`): the cover stays straight and shrinks to 80 %, the title fades, and once the header's bottom nears the app header a compact bar with the title and a play button fades in over its left side (it is `inert` while hidden and never covers the bell or the account menu; on mobile the Waven logo steps aside). Pages too short to scroll the header away never show the bar. A soft light follows the mouse over the header (mouse only, decorative). Under reduced motion there is no scaling, fading or light: the bar just appears.
- Now Playing is a full-screen modal opened from the player bar (its cover or an expand button) and from the mini player (it replaces the old mobile player sheet). Its cover grows out of the player's cover, and the background is a mesh of blurred blobs in the cover's Dynamic palette, scoped to the view whatever theme the user picked (Free included). The mesh slows to 15 % while paused and stands still under reduced motion. "Up next" lists the next five tracks of the play order (clicking one plays it), and the queue page keeps the rest and the reordering.
- The Premium activation moment plays on `/billing/return` only after the API confirms the plan, once per activation: it is keyed by subscription id in `localStorage`, so reloads and later visits skip it (a new subscription plays it again). The Premium plan card has a slow conic border beam (still under reduced motion), and the empty Liked Songs and empty playlist states show a grayscale mosaic of showcase covers that lights up around the mouse (decorative, mouse only).
