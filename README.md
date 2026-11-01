# Formloom

Open-source AI form builder. Describe a form in one sentence; get questions, validation, conditional logic and a live spreadsheet of responses. Keep editing by talking to it. For individuals and organisations (personal and team workspaces with owner / editor / viewer roles).

## Run locally

```bash
bun install
docker compose -f compose.local.yaml up -d      # Postgres :5452, Valkey/Redis :6395 (localhost only)
cp .env.example .env.local                      # set AUTH_SECRET (openssl rand -base64 33) and ANTHROPIC_API_KEY
set -a; source .env.local; set +a; bunx drizzle-kit push
bun run dev
```

Checks: `bun run check` (typecheck, lint, logic tests) and `bun run build`.

## What is in it

- **AI designer** (`src/features/ai`): Claude returns the whole form plus clarifying questions (one-click answers) and improvement suggestions. Every validated field carries example answers that must pass and fail; the builder re-runs them against the real validator and flags any that disagree.
- **Builder** (laid out like Google Forms): centered Questions / Responses / Settings tabs, a floating toolbar beside the selected question, Send dialog, drag to reorder, conditional logic, validation with a rule well, undo, autosave, toggleable assistant.
- **Question types**: short, paragraph, email, number, phone, link, date, time, multiple choice (+ Other), checkboxes, dropdown (searchable), linear scale, rating, file upload, section breaks.
- **Responses**: 14-day chart, per-question summaries, a virtualized spreadsheet grid (sort, resize, search, keyboard, copy), CSV.
- **Spreadsheets**: "Link to Sheets" creates a Google Sheet in your Drive (OAuth, `drive.file` scope only), backfills every response and appends new ones; resync and unlink. No-sign-in alternatives: live CSV feed for Google Sheets (`=IMPORTDATA(...)`) and Excel (Data > From Web), and a webhook (SSRF-guarded, retried) with a ready Apps Script.
- **Quizzes**: answer keys with points and feedback; scores shown on submit (or held back); keys never reach the respondent's browser; average score in Responses.
- **Edit after submitting**: optional private edit link per response; edits re-validate and re-sync.
- **Reliable delivery**: webhook posts and Sheets rows go through a Postgres outbox with backoff and dead-lettering. Call `POST /api/jobs/deliveries` with header `x-job-key: $JOB_KEY` from a cron (every minute) to retry anything that failed.
- **Workspaces**: a personal workspace per account, team workspaces with owner / editor / viewer roles and invite links.
- **Uploads**: `STORAGE_DRIVER=local` (./uploads) or `r2` (Cloudflare R2).
- **PWA**: installable; opened forms work offline and submissions queue until the device reconnects.

## Architecture

Next.js 16 (App Router) on Bun, Drizzle over Postgres, behind a service layer (`features/*/server/service.ts`), two-tier cache (LRU over Redis) for public form reads, Auth.js (email/password, optional Google), Zod at every boundary.

## Configuration notes

- **Google Sheets link**: in Google Cloud Console enable the Google Sheets API, add scopes `drive.file`, `openid`, `email` to the OAuth consent screen, and add `${NEXT_PUBLIC_APP_URL}/api/integrations/google/callback` as a redirect URI on the web client used for `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
- **`TRUST_PROXY`** decides which header gives the client IP for rate limits: `none` (default: no headers trusted, safe when exposed directly), `proxy` (last `x-forwarded-for` hop; set it when you run behind your own reverse proxy), or `cloudflare` (`cf-connecting-ip`). Never use `proxy` on a server reachable without that proxy.
- Local containers bind `127.0.0.1` only; use `127.0.0.1` (not `localhost`) in `DATABASE_URL` / `REDIS_URL`.
