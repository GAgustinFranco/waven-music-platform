# Waven — Roadmap

One phase per session. Within each phase, backend first and frontend second. A phase is done when CI is green and its criteria are met.

## Changes from the suggested order

- **The original phase 3 is split into 3 (shell + design system + catalog pages) and 4 (player):** together they do not fit in one session, and the player deserves its own focus.
- **The admin panel gets its own phase (8):** the ambitious frontend makes it large. Its basic CRUD endpoints are born in phase 2, because the seed reuses them.
- **Search is separated from the library:** search (with `pg_trgm` and search-as-you-type UX) and playlists (with drag and drop) are one session each.
- **Billing moves to phase 9:** the Mercado Pago account is not ready yet, and it blocks nothing before it.
- **Deployment comes in phase 10, but the `/api` proxy exists from phase 1:** that removes the cross-domain cookie risk.

---

### Phase 0 — Structure, Docker and CI
- pnpm monorepo, strict `tsconfig.base`, ESLint and Prettier at the root, and commitlint (Conventional Commits) with a husky hook.
- `docker-compose.yml` with `db` (5432) and `db-test` (5433), on Postgres 16.
- API: validated config, Helmet, CORS, throttler, pino, Swagger at `/docs`, `GET /health`, TypeORM data source and migration scripts.
- Web: Next.js with App Router + Tailwind + shadcn initialized, and the `/api` rewrite.
- CI: lint, typecheck, test and build on every push, with a Postgres service container.

**Acceptance criteria**
- [x] `pnpm i && pnpm db:up && pnpm dev` starts web (3000) and api (4000).
- [x] `/api/health` responds from the web.
- [x] The API does not start if a required environment variable is missing.
- [x] CI is green on GitHub.

### Phase 1 — Authentication
- User and RefreshToken entities with their migration.
- Passport Google, access JWT + refresh with rotation and reuse detection, `ADMIN_EMAILS`, global guards (`JwtAuthGuard`, `RolesGuard`) and `GET/PATCH /me`.
- OpenAPI pipeline: `export-openapi` → `openapi-typescript` → `openapi-fetch` client with refresh middleware.
- Web: `/login` page, `auth.store`, redirect middleware and a minimal user menu.

**Acceptance criteria**
- [x] End-to-end Google login works locally.
- [x] The refresh after 15 min is transparent.
- [x] Reusing a refresh token revokes the family (e2e test).
- [x] An admin endpoint returns 403 to a user (e2e test).
- [x] CI fails if `openapi.json` or `schema.ts` are out of date.

### Phase 2 — Catalog, storage, seed and streaming (backend only)
- Artist, Album and Track entities with slugs; `StorageDriver` (local + s3); MediaService (ffmpeg 128/320, sharp for covers and dominant color) and in-process queue.
- Admin CRUD for artists, albums and tracks, with file uploads.
- `seed-jamendo` (configurable, with attribution) and `import-local`.
- Public catalog endpoints and `/browse/home`; `POST /tracks/:id/stream` and `GET /stream/:id` with Range.

**Acceptance criteria**
- [x] `pnpm seed` leaves ≥ 300 `ready` tracks in two qualities.
- [x] Range e2e tests: 206 with a correct `Content-Range`, 416 out of range, 401 with an expired token or another user's token.
- [x] A Free user gets std quality (test). Later changed: every plan streams at 320 kbps (SPEC §8).
- [x] An admin upload with an invalid type is rejected.

### Phase 3 — Frontend shell, design system and catalog pages
- Tokens, typography, responsive layout (sidebar, content, room for the player bar and bottom navigation on mobile) and skeletons.
- Base components: TrackRow, MediaCard, headers with the dominant-color gradient.
- Home, Artist and Album pages with TanStack Query; empty and error states.

**Acceptance criteria**
- [x] Looks right at 360, 768, 1280 and 1920 px.
- [x] Lighthouse a11y ≥ 95 on Home and Album.
- [x] Full keyboard navigation with visible focus.
- [x] Zero hardcoded color values outside the tokens.

### Phase 4 — Player
- `player.store` (queue, index, shuffle, repeat, volume and mute), audio engine with next-track preloading and token renewal on expiry.
- Fixed bar, reorderable queue view, full-screen player on mobile, Media Session and keyboard shortcuts (Space, ←/→, Shift+←/→, M, S, R).
- History report at 30 s (the minimal endpoint is created in this phase).

**Acceptance criteria**
- [x] Playing an album, skipping tracks, seeking and shuffle all work.
- [x] The queue and volume are restored on reload.
- [x] The operating system's media controls work.
- [x] Store unit tests: queue order, shuffle without repeats and repeat modes.

### Phase 5 — Playlists and favorites
- Backend: CRUD, add, remove and reorder in a transaction, plan limit (`PLAN_LIMIT_REACHED`) and favorites.
- Web: library in the sidebar, playlist page with drag and drop, "Add to playlist" context menu, optimistic hearts and favorites page.

**Acceptance criteria**
- [x] A Free user's sixth attempt shows the upgrade prompt.
- [x] Someone else's playlist returns 404 (e2e test).
- [x] Reordering persists and stays consistent with two tabs open.

### Phase 6 — Search and history
- Backend: `pg_trgm` + `unaccent` with GIN indexes, `/search` grouped by type and `GET /me/history`.
- Web: search as you type (debounced, synced with the URL), results with a "top result", history page and "recently played" on Home.

**Acceptance criteria**
- [x] "cafe" finds "Café".
- [x] A simple typo finds the result.
- [x] p95 < 100 ms with the seeded catalog.
- [x] History is paginated and has no duplicates of the same play.

### Phase 7 — Profile and UX polish
- Profile and plan page, toasts, `motion` transitions, illustrated empty states, prefetch on hover and a contrast review.

**Acceptance criteria**
- [x] No layout shift (CLS < 0.1).
- [x] Everything works with `prefers-reduced-motion`.

### Phase 8 — Admin panel
- Backend: `/admin/users`, `/admin/subscriptions` and `/admin/stats`.
- Web: protected `/admin` routes; tables with search and pagination; artist, album and track forms with file upload, a progress bar and transcoding status; dashboard with simple charts.

**Acceptance criteria**
- [x] An admin creates an album with a cover and 2 tracks, and they are playable without restarting the API.
- [x] A user cannot access `/admin` (neither on the web nor on the API).

### Phase 9 — Billing with Mercado Pago (sandbox)
- Prerequisites: Mercado Pago account, test users (seller and buyer), webhook secret and a `cloudflared` tunnel.
- Backend: `PaymentProvider` with both implementations, Subscription with its state machine, webhook with signature and idempotency, and cancellation.
- Web: plans page, redirect to checkout, `/billing/return` with polling, subscription management and a Premium badge.

**Acceptance criteria**
- [x] The end-to-end sandbox payment enables Premium and high quality.
- [x] A duplicate webhook changes nothing (e2e test).
- [x] An invalid signature returns 401.
- [x] Switching to `PAYMENT_MODE=onetime` works without touching the domain.

### Phase 9b — Premium themes
- Backend: `theme` and `backdrop` on User with their migration, `PATCH /me` gated by plan, effective appearance in `GET /me`, album dominant color on every track.
- Web: theme tokens, soft-glow backdrop, Dynamic accent from the album playing, Appearance picker on the profile, cover-tinted full-screen player for every plan.

**Acceptance criteria**
- [x] A Premium user switches among 8 themes and 3 backdrops (Solid, Soft glow, Ambient); only colors change.
- [x] A Free user sees the themes locked, and the API refuses them with 403 `PREMIUM_REQUIRED`.
- [x] Going back to Free shows the default and keeps the saved choice (e2e test).
- [x] The Dynamic accent follows the album playing and always passes AA contrast.

### Phase 10 — Hardening, deployment and README
- Playwright tests of the main journey in CI.
- Deployment on Vercel, Render, managed Postgres and R2 (production seed).
- README with Mermaid, screenshots, setup in ≤ 5 commands and a link to `/docs`; security review and `pnpm audit`.

**Acceptance criteria**
- [ ] The public demo works with login, playback and a sandbox upgrade.
- [ ] Playwright is green in CI.
- [ ] A fresh clone starts the app by following the README.
