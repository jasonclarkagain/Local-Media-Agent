# Echo — Local Autonomous Media Assistant

Echo is a self-hosted media automation system. Issue natural language commands ("Download everything The Rolling Stones ever did") and Echo parses the intent with a local LLM, orchestrates tool calls to qBittorrent, Prowlarr, Lidarr, Radarr, and Sonarr, and streams real-time job progress back to you.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/echo-ui run dev` — run the web UI (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind + shadcn/ui + wouter + React Query

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema: `jobs.ts`, `jobLogs.ts`, `settings.ts`
- `artifacts/api-server/src/routes/` — Express route handlers (commands, jobs, downloads, search, settings, stats)
- `artifacts/api-server/src/lib/` — Service integration modules:
  - `qbittorrent.ts` — qBittorrent WebAPI v2 client (auth, list, add magnet, delete)
  - `prowlarr.ts` — Prowlarr search API client
  - `ollama.ts` — Ollama LLM client (tool-calling / function-calling for intent parsing)
  - `arr-services.ts` — Lidarr / Radarr / Sonarr API wrappers (add artist/movie/series)
  - `orchestrator.ts` — Main async pipeline: parse intent → dispatch to *arr or Prowlarr → log to DB
- `artifacts/echo-ui/src/` — React frontend (Dashboard, Console, Downloads, Search, Jobs, Settings)

## Architecture decisions

- **Async job model**: `POST /api/commands` inserts a job record and returns immediately (202). `setImmediate` kicks off `runOrchestration()` in the background which writes progress and logs to the DB. The frontend polls `/api/jobs` every 3s to show live state.
- **Settings stored in DB**: A single-row `settings` table (id=1) holds all service URLs and credentials. The orchestrator reads settings fresh on each job run so changes take effect immediately.
- **LLM with fallback**: If Ollama is unreachable, a rule-based fallback parser handles the intent extraction so Echo still works without an LLM.
- **Cascade dispatch**: For music, if Lidarr is configured, it takes priority. If it fails or isn't configured, Echo falls back to Prowlarr search → qBittorrent. Same cascade for movies (Radarr) and TV (Sonarr).
- **Service integration libs are standalone classes**: `QBittorrentClient`, `ProwlarrClient`, `OllamaClient` are pure HTTP wrappers — no singletons, instantiated per-request with settings from DB.

## Product

- **Dashboard** — Live stats (active jobs, downloads, total data), service health panel, recent job feed
- **Console** — Terminal-style command input + live process feed with expandable job logs
- **Downloads** — Real-time qBittorrent torrent list with progress bars, speeds, and ETA
- **Search** — Prowlarr torrent search with one-click add to qBittorrent
- **Jobs** — Full job history with status filters and detailed log viewer
- **Settings** — Configure Ollama, qBittorrent, Prowlarr, Lidarr, Radarr, Sonarr with "Test Connections"

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after every OpenAPI spec change before touching route handlers
- OpenAPI body schema names must be entity-shaped (`NoteInput`) not operation-shaped (`CreateNoteBody`) to avoid Orval TS2308 collisions
- The `DELETE /downloads/{hash}` endpoint must NOT have query parameters — Orval generates both a Zod schema AND a TypeScript type for Params, causing a TS2308 collision when both are re-exported from the `api-zod` barrel
- DB migrations happen automatically on Publish; never write custom migration scripts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
