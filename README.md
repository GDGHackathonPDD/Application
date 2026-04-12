# AiGenda

Single Next.js app combining the **Convex + Clerk** backend with the **shadcn / MVP** UI.

## User flows

Short descriptions of primary journeys. Technical backend is **Convex + Clerk** unless noted.

### 1. First visit

1. User lands on marketing or app entry.
2. **User signs in via Clerk** (first time → account is created in Clerk; the app calls **`users.ensureExists`** to create the Convex `users` row).
3. User may complete onboarding (timezone, defaults) per product requirements.

### 2. Task and availability setup

User adds tasks and weekly availability. Changes save **via Convex mutations** and appear on the dashboard through reactive queries.

### 3. Recovery dashboard

User reviews overload, feasibility, and plan. Data loads **from Convex** (`dashboard.get`); updates reflect without manual refresh when documents change.

### 4. Plan generation

User triggers plan generation. The client invokes the **`plans.generate` action**, which calls the Agent API and writes plan + mini tasks through internal mutations.

### 5. Today / checklist

User marks progress on checklist items. Updates go through **Convex mutations** (`checklist.update`, etc.).

### 6. Canvas ICS (optional)

User pastes an HTTPS Canvas calendar feed URL and runs sync. **Save** uses `canvasIcs.saveSettings`; **sync** uses **`canvasIcs.sync`** (action) to fetch ICS and upsert tasks.

### 7. Daily nudge / summary

**Convex cron** runs **`dailySummary.generateForAll`** daily at **06:00 UTC** (see `convex/crons.ts`) — no HTTP cron hitting `/api/daily-summary`.

### 8. Settings / account

User manages profile and integrations in Clerk and app settings as implemented.

### 9. Diagram (data flow)

```
User → Clerk auth → Next.js (ConvexProviderWithClerk) → Convex queries/mutations/actions
                                                              ↓
                                                    Save via Convex → Convex tables
```

*Specs: [`../frontend_mvp/docs/spec-backend.md`](../frontend_mvp/docs/spec-backend.md), [`../frontend_mvp/docs/spec-frontend.md`](../frontend_mvp/docs/spec-frontend.md).*

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in Clerk and Convex values (see [`../backend/.agents/CONVEX_MIGRATION_PLAN.md`](../backend/.agents/CONVEX_MIGRATION_PLAN.md) if you use the same deployment).
2. **Env:** `.env.local` at this project root holds Clerk, Convex, **`AGENT_API_*`**, and **`OPENROUTER_API_KEY`**. The Python Agent API lives in **`../Agent/`** at the repo root and reads this app’s `.env.local` automatically when present (see `../Agent/README.md`). You can also use `../Agent/.env`. In the **Convex dashboard**, set `AGENT_API_URL` (e.g. `http://127.0.0.1:8000` locally, or your Cloud Run URL in production) and `AGENT_API_KEY` so actions can call `/decompose`, `/plan-copy`, and `/daily-summary`.
3. **Agent API (Python):** `cd ../Agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
4. Install dependencies: `npm install`
5. Run Convex: `npx convex dev` (generates types and syncs functions).
6. Run the Agent API: `npm run agent-api` (from this directory; uses `../Agent`, reads env as above).
7. Run the app: `npm run dev`

## Commands

- `npm run dev` — Next.js with Turbopack
- `npm run agent-api` — FastAPI Agent service in `../Agent/` (needs `../Agent/.venv`; env from `Agent/.env` **or** `Application/.env.local`)
- `npm run build` — Production build (root layout uses `dynamic = "force-dynamic"` so a local build works without env; configure real keys for production)
- `npm run lint` — ESLint

## Calendar ICS (Canvas URL or .ics upload)

- **Canvas feed:** HTTPS URLs whose host is `instructure.com`, `*.instructure.com`, or `*.canvaslms.com` (and optional `CANVAS_ICS_EXTRA_ALLOWED_HOSTS` in the Convex dashboard for dev tunnels). Saving a URL clears a previously uploaded file.
- **Upload:** Any standard `.ics` file (Google Calendar, Apple Calendar, Outlook, etc.) up to **512 KB**, stored in Convex. **Sync** prefers the uploaded file over the feed URL when both exist.
- **Sync now** stays disabled until you either **Save URL** or **upload an .ics file** successfully.
- For **local testing** with a non-Canvas host, set Convex env `CANVAS_ICS_EXTRA_ALLOWED_HOSTS` (comma-separated hostnames). See `convex/lib/canvas/ics.ts`.

## Structure

- `../Agent/` — Python FastAPI agent (OpenRouter); deploy to Cloud Run or sslip VM — see `../Agent/README.md`
- `convex/` — Schema, queries, mutations, actions (source of truth)
- `src/app/` — App Router, `providers.tsx` (Clerk → Convex → provision → theme), `proxy.ts` for Clerk route protection (Next.js 16)
- `src/components/` — UI including `convex-provision-context.tsx` and AiGenda screens
- `src/lib/convex-to-momentum.ts` — Maps Convex shapes to MVP `lib/types/momentum` types

## To Change overall shadcn theme of the site:
```bash
npx shadcn@latest init --preset [your-preset-code] -f -y
```
do *NOT* re-install UI components
