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
| GET | `/search?q=&type=&limit=` | user | `type` = `track`\|`album`\|`artist`\|`all`. |

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
| POST | `/me/history` | user | Takes `{ trackId, msPlayed, context }`. |
| GET | `/me/history` | user | |

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
