# scripts/lib/

Shared helpers for pipeline and sync scripts.

## Write policy

**All new sync/pipeline writes to Supabase must use `safeUpsert` / `safeInsert`** from `./safe-write`.

Direct `supabase.from(x).upsert(...)` or `.insert(...)` in `scripts/` is deprecated. Under Supabase JS v2 these calls do not throw on 400/PGRST errors — they return errors inline. Any script that doesn't destructure `{ error }` and check it will silently swallow failures and keep logging success.

The overnight 2026-04-16 `globalpc-delta-sync.js` regression is the canonical example: it logged `"✅ 654 updated"` every 15 minutes for ~33 hours while writing zero rows. The schema had drifted (`clave_cliente` column removed, `tenant_id` NOT NULL added) and nothing noticed.

`safeUpsert` / `safeInsert`:
- Throw on Supabase error (so the outer try/catch surfaces it)
- Fire a 🔴 Telegram alert on error with the script name + table + error message
- Fire a 🟡 Telegram alert when `attempted > 0 && written === 0`
- Route through `./telegram` — no new fetch-to-API duplicates

```js
const { safeUpsert, safeInsert } = require('./lib/safe-write')

await safeUpsert(supabase, 'traficos', batch, {
  onConflict: 'trafico',
  scriptName: 'nightly-pipeline',
})

await safeInsert(supabase, 'operational_decisions', row, {
  scriptName: 'wsdl-document-pull',
  silentOnDuplicate: true, // for tables where dup-key is expected, not an error
})
```

## Drift check

Before pushing changes to a sync script:

```bash
npm run check:sync
```

Runs `scripts/check-safe-writes.sh` — grep-based warn-only detector that flags any bare `.upsert(` or `.insert(` in a sync script not wrapped in `safeUpsert` / `safeInsert`. Exit code is always 0 (warn, not block) so CI doesn't wake you up, but the list tells you what still needs migrating.

`scripts/lib/`, `scripts/archive/`, `*.bak*`, and test files are excluded.
