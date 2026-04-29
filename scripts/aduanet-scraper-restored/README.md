# aduanet-scraper-restored

Restored from `~/.Trash/workspace/scripts/aduanet-scraper/` on 2026-04-29.

## Status

**Auth verified working.** A focused 3-step `loginI → login_auth → loginV` probe
(see `scripts/_aduanet-auth-probe.mjs`) authenticates successfully against
`aduanetm3.net` from this Mac with the credentials currently in `.env.local`.
Returns `VALID|Bienvenido||2|8|`.

## Why "restored" rather than canonical

The Throne production runner (the one currently logging daily auth failures
to `scrape_runs`) has **diverged** from every script in this directory —
its error string `"Login failed — still on: <url>"` doesn't match any
`throw new Error(...)` line in any of the four scrapers here. Whichever
script Throne actually runs is a fork that was never merged back.

These four scripts are the closest reconstructable state from the laptop's
`.Trash`. Treat them as a recovery starting point, not as the production
source of truth.

## Files of interest

| File | Purpose |
|---|---|
| `src/aduanet.js` | Canonical 542-line scraper. Login, search pedimentos, extract partidas + DTA/IGI/IVA contribuciones, search COVEs, write to Supabase. |
| `src/scraper.js` | Older Playwright-based variant. Retained for reference. |
| `src/scraper-v2.js` | Mid-revision https-based variant. Retained for reference. |
| `src/index.js` | "v3" simplified variant. Doesn't extract contribuciones. |
| `src/db.js` | Supabase write helpers — known-good schema match for `scrape_runs`. |
| `src/downloader.js` | Document downloader, separate concern. |
| `migrations/` | Original migration files for the scraper's tables. |
| `logs/` | Historical run logs from the script's last successful era (Mar 13–Apr 1). |

## Tables the canonical scraper writes

- `pedimentos` (upsert on pedimento_id)
- `partidas` (upsert on pedimento_id + partida_numero)
- `coves` (delete + insert per pedimento)
- `scrape_runs` (insert with the live flat schema: status / pedimentos_count / coves_count / error_msg / duration_ms / ran_at)

**Does NOT write `aduanet_facturas`.** That table is only populated by the
manual XLSX import path at `scripts/aduanet-import.js` (which was
tenant-fenced separately on 2026-04-29).

## Known issues before production use

1. **Hardcoded `company_id: 'evco'`** at `src/aduanet.js:432` (COVEs write).
   Same tenant-isolation bug that `scripts/aduanet-import.js:129` had until
   today's fix. Needs the same allowlist-derive treatment before this
   scraper is scheduled — otherwise multi-client COVEs get mis-tagged.
2. **`SUPABASE_URL` env name** (`src/aduanet.js:27`) doesn't match the
   laptop's `NEXT_PUBLIC_SUPABASE_URL`. Either patch the script or set
   the var explicitly when invoking.
3. **`require('dotenv').config()`** with no path — looks for `.env` in
   CWD. From the parent repo, run with `--cwd scripts/aduanet-scraper-restored`
   or patch the dotenv path.
4. The `winston` logger dependency requires `npm install` inside this dir
   (the original `node_modules` was stripped).

## How auth was verified

```
node scripts/_aduanet-auth-probe.mjs 2>&1 | tee /tmp/aduanet-auth-probe.log
```

Probe is read-only; no Supabase writes. Result captured 2026-04-29:
3-step login flow returns 200 / `VALID` / cookies persist correctly.
No CSRF tokens, zero hidden form fields, no auth changes server-side.

