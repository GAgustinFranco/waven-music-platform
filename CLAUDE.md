# Waven — guide for Claude

Music streaming app (portfolio MVP). Details live in `docs/SPEC.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`: read them only when needed.

## Stack
- Strict TypeScript · pnpm workspaces · Node 24 LTS
- `apps/api`: NestJS, TypeORM + PostgreSQL (migrations only), Passport Google + JWT, Swagger at `/docs`, pino, ffmpeg and sharp
- `apps/web`: Next.js App Router, Tailwind + shadcn/ui, TanStack Query, Zustand and a generated `openapi-fetch` client
- Payments: Mercado Pago sandbox behind `PaymentProvider` (`PAYMENT_MODE=preapproval|onetime`)
- Storage: `StorageDriver` local (dev) / S3-R2 (prod)

## Structure
```
apps/api/src/{config,common,database/migrations,modules/*}  apps/api/{scripts,test}
apps/web/src/{app,components/{ui,layout,player},features,lib/api,stores,styles}  apps/web/e2e
docs/  docker-compose.yml  .github/workflows/
```

## Commands
- `pnpm db:up` / `pnpm db:down`: start or stop Postgres (dev on 5432, test on 5433)
- `pnpm dev`: web on 3000 and api on 4000 (the web proxies `/api` → api)
- `pnpm -F api migration:generate src/database/migrations/<Name>` · `pnpm -F api migration:run`
- `pnpm -F api seed`: imports from Jamendo · `pnpm -F api catalog:import <dir>`: local only
- `pnpm openapi`: exports `openapi.json` and regenerates `apps/web/src/lib/api/schema.ts`
- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm -F api test:e2e` · `pnpm -F web e2e`

## Language
- Everything in the repository is in English: code, comments, UI text, docs, README, this file and commit messages.
- The only Spanish is the chat with me.

## Code conventions
- Conventional Commits (`feat(api): …`, `fix(web): …`), small commits per feature.
- No `any` and no `@ts-ignore`. Validate at the boundaries with class-validator DTOs and `ParseUUIDPipe`.
- Nest: one module per domain; thin controllers, logic in services. Resource ownership is checked in the service, and someone else's resource returns 404.
- Never `synchronize: true`. Every schema change ships with its migration.
- API errors: `{ statusCode, code, message }`, with a stable `code` (for example, `PLAN_LIMIT_REACHED`).
- Web: server data only through TanStack Query (query key factories in `lib/api`); Zustand only for the player and the session. Colors and spacing only through tokens, never hardcoded values.
- Accessibility: WCAG AA, visible focus, accessible names on icon buttons, and respect `prefers-reduced-motion`.
- If the API changes, run `pnpm openapi` and commit both generated files.

## Security
- Never read, edit or commit `.env*` (only `.env.example`). No secrets in code or logs.
- Webhooks always verify the signature and deduplicate. State comes from the Mercado Pago API, never from the payload.
- Copyrighted music is used only locally, through `catalog:import`; never in the seed or in deployments.

## Git rules (mandatory)
- I handle Git manually. NEVER commit, push, merge, rebase or stash, and never create or switch branches. Read-only commands only (`git status`, `git diff`, `git log`).
- I work with one branch per feature (`feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`) and Pull Requests into `main` with squash merge.
- When each task is done, suggest the branch name (if needed) and the commit messages in Conventional Commits format, split into small, logical commits, and tell me when to push. Only suggest them; do not run anything.
- Never add `Co-Authored-By` lines, "Generated with Claude Code" or any attribution to Claude in commits or PR descriptions.
- Do not touch `.git` or the Git configuration.

## How to work with me
- Talk to me in Spanish, briefly, without repeating what is already in `docs/`.
- One roadmap phase per session. Before starting, propose a short plan and wait for my approval.
- Within a phase: backend first, with its tests, then the frontend.
- Read specific files; do not explore the whole repo.
- Do not add dependencies without a one-line justification.
- When closing a phase: lint, typecheck and tests green, and tick the criteria in `docs/ROADMAP.md`.
- If something is ambiguous but not critical, decide, record it in the "Assumptions" section of `docs/SPEC.md` and move on.
