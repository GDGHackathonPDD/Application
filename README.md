# Momentum Coach (integrated)

Single Next.js app combining the **Convex + Clerk** backend with the **shadcn / MVP** UI.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in Clerk and Convex values (see `backend/.agents/CONVEX_MIGRATION_PLAN.md` if you use the same deployment).
2. **Env:** `.env.local` at this `Application/` root holds Clerk, Convex, **`AGENT_API_*`**, and **`OPENROUTER_API_KEY`**. The Python Agent API lives in **`../agent-api/`** at the repo root and **reads `Application/.env.local` automatically** when present (see `../agent-api/README.md`). You can also use `agent-api/.env`. In the **Convex dashboard**, set `AGENT_API_URL` (e.g. `http://127.0.0.1:8000` locally, or your Cloud Run URL in production) and `AGENT_API_KEY` so actions can call `/decompose`, `/plan-copy`, and `/daily-summary`.
3. **Agent API (Python):** `cd ../agent-api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
4. Install dependencies: `npm install`
5. Run Convex: `npx convex dev` (generates types and syncs functions).
6. Run the Agent API: `npm run agent-api` (from this directory; uses `../agent-api`, reads env as above).
7. Run the app: `npm run dev`

## Commands

- `npm run dev` — Next.js with Turbopack
- `npm run agent-api` — FastAPI Agent service in `../agent-api/` (needs `../agent-api/.venv`; env from `../agent-api/.env` **or** `Application/.env.local`)
- `npm run build` — Production build (root layout uses `dynamic = "force-dynamic"` so a local build works without env; configure real keys for production)
- `npm run lint` — ESLint

## Calendar ICS (Canvas URL or .ics upload)

- **Canvas feed:** HTTPS URLs whose host is `instructure.com`, `*.instructure.com`, or `*.canvaslms.com` (and optional `CANVAS_ICS_EXTRA_ALLOWED_HOSTS` in the Convex dashboard for dev tunnels). Saving a URL clears a previously uploaded file.
- **Upload:** Any standard `.ics` file (Google Calendar, Apple Calendar, Outlook, etc.) up to **512 KB**, stored in Convex. **Sync** prefers the uploaded file over the feed URL when both exist.
- **Sync now** stays disabled until you either **Save URL** or **upload an .ics file** successfully.
- For **local testing** with a non-Canvas host, set Convex env `CANVAS_ICS_EXTRA_ALLOWED_HOSTS` (comma-separated hostnames). See `convex/lib/canvas/ics.ts`.

## Structure

- `../agent-api/` — Python FastAPI agent (OpenRouter); deploy to Cloud Run — see `../agent-api/README.md`
- `convex/` — Schema, queries, mutations, actions (source of truth)
- `src/app/` — App Router, `providers.tsx` (Clerk → Convex → provision → theme), `proxy.ts` for Clerk route protection (Next.js 16)
- `src/components/` — UI including `convex-provision-context.tsx` and Momentum screens
- `src/lib/convex-to-momentum.ts` — Maps Convex shapes to MVP `lib/types/momentum` types
