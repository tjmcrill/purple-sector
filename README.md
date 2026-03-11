# F1 Lap Time Duel

Next.js 15 + TypeScript + Tailwind app for comparing the fastest qualifying laps of two F1 drivers at the same circuit. Historical qualifying data comes from Jolpica, modern sector enrichment comes from OpenF1, and the app uses Supabase as the cache and query layer.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Jolpica (`ERGAST_BASE_URL`)
- OpenF1 (`OPENF1_BASE_URL`)

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Apply the SQL migration in [`supabase/migrations/20260310235900_initial_schema.sql`](/Users/tjmcrill/Documents/purple-sector/supabase/migrations/20260310235900_initial_schema.sql) to your Supabase project.

3. Seed metadata and lap caches:

```bash
pnpm seed:drivers
pnpm seed:circuits
pnpm backfill:laps -- --circuit silverstone
pnpm backfill:laps -- --circuit silverstone --season 2023
pnpm seed:starter-data
```

4. Start the app:

```bash
pnpm dev
```

## Scripts

- `pnpm seed:drivers` seeds the `drivers` table from Jolpica.
- `pnpm seed:circuits` seeds current-circuit SVG paths into the `circuits` table.
- `pnpm backfill:laps -- --circuit <circuitId>` backfills qualifying history for one circuit.
- `pnpm backfill:laps -- --circuit <circuitId> --season <year>` enriches that circuit-season with OpenF1 sector data.
- `pnpm seed:starter-data` seeds drivers, seeds the recent-era circuits, backfills those circuits, and enriches qualifying sectors for 2023 through round 1 of 2026.
- `pnpm audit:data` prints circuit-by-season cache and sector coverage.

## Routes

- `/api/metadata/circuits`
- `/api/metadata/drivers`
- `/api/duel?driverA=<id>&driverB=<id>&circuitId=<id>&season=<year optional>`
- `/api/cron/weekly-sync`

## Notes

- The browser does not query Supabase directly; all DB access stays server-side.
- `ERGAST_BASE_URL` is set to Jolpica, not the retired `ergast.com` host.
- Sector markers and start/finish markers are optional; the UI tolerates them being null.
- `vercel.json` schedules `/api/cron/weekly-sync` for `0 2 * * 1`, which is Sunday at 10:00 PM Eastern during daylight saving time.
- Vercel cron schedules are UTC-only, so this will run at 9:00 PM Eastern during standard time unless you later switch the schedule seasonally.
- Add `CRON_SECRET` in Vercel project settings so the scheduled request is authorized in production.
