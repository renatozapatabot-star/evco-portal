# Throne sync pipeline restore — V1 launch prep

Last clean heartbeat: **2026-04-02 (13+ days ago).**
Aduanet facturas freshest: **2026-03-09 (5+ weeks).**
Per audit, `heartbeat-check.js` was silently failing inserts because the
script wrote `{checked_at, all_ok, results_json}` while the table actually
uses flat booleans `(pm2_ok, supabase_ok, vercel_ok, sync_ok, sync_age_hours,
all_ok, details)`. Fixed in commit `65bd7c9`.

## What you (Renato IV) run on Throne

These commands assume your laptop is the source of truth (the repo at
`~/evco-portal` reflects what's deployed). If Throne pulls from git
directly, swap rsync for `git pull` on Throne instead.

### 1. Sync the fixed scripts to Throne

```bash
# From your laptop. Replace THRONE_HOST + THRONE_USER if different.
THRONE_USER=renato                          # adjust if needed
THRONE_HOST=throne.local                    # or its real hostname / IP
THRONE_PATH=~/evco-portal                   # path on Throne

# Sync only the script tree + the .env.local (heartbeat reads it for keys).
rsync -avz --include='scripts/***' --include='.env.local' --exclude='*' \
  --progress \
  ~/evco-portal/  ${THRONE_USER}@${THRONE_HOST}:${THRONE_PATH}/
```

### 2. SSH in and verify the file got there

```bash
ssh ${THRONE_USER}@${THRONE_HOST}
cd ~/evco-portal
git diff scripts/heartbeat.js          # confirm the fix is present
head -20 scripts/heartbeat.js          # should show the V2 banner comment
```

### 3. Restart the heartbeat (it runs from crontab, NOT pm2)

```bash
# heartbeat.js is invoked by crontab every 15min — verify the cron line.
crontab -l | grep heartbeat

# Expected: */15 * * * * cd ~/evco-portal && node scripts/heartbeat.js >> ~/heartbeat.log 2>&1

# If missing or commented, add it:
( crontab -l 2>/dev/null | grep -v heartbeat
  echo "*/15 * * * * cd $HOME/evco-portal && /usr/local/bin/node scripts/heartbeat.js >> $HOME/heartbeat.log 2>&1"
) | crontab -

# Force one immediate run to verify:
cd ~/evco-portal && node scripts/heartbeat.js
```

### 4. Verify the row landed in Supabase

Back on your laptop:

```bash
cd ~/evco-portal && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('heartbeat_log').select('checked_at, pm2_ok, supabase_ok, vercel_ok, sync_ok, sync_age_hours, all_ok, details').order('checked_at', { ascending: false }).limit(1).maybeSingle().then(r => {
  console.log(JSON.stringify(r.data, null, 2))
  if (!r.data) console.log('NO ROW — heartbeat did not write')
  else if (new Date(r.data.checked_at).getTime() < Date.now() - 60*60*1000) console.log('STALE — last write > 1h ago')
  else console.log('FRESH ✓')
});"
```

Expected output: a row dated within the last few minutes, with `pm2_ok`,
`supabase_ok`, `vercel_ok` all `true`, `sync_ok` reflecting actual state.

### 5. PM2 sync processes — restart whichever are dead

```bash
# On Throne
pm2 status                              # see what's up
pm2 restart all                         # nuclear; or restart specific:
pm2 restart cruz-bot
pm2 restart globalpc-sync
pm2 restart workflow-processor
pm2 save                                # CRITICAL — persists across reboot
```

Per CLAUDE.md learned rule: **`pm2 save` after every process change. Every
time. Non-negotiable.**

### 6. Trigger one full sync to refresh stale data

```bash
# Aduanet facturas — 5 weeks stale
cd ~/evco-portal && node scripts/full-sync-econta.js

# GlobalPC delta
node scripts/globalpc-delta-sync.js
```

Watch each script's output. If it errors, the error is the next thing to fix.

## Acceptance — V1 launch unblocks when these all pass

- [ ] `heartbeat_log` shows a row with `checked_at` < 1h ago AND `all_ok = true`
- [ ] `aduanet_facturas` shows a `created_at` within last 24h
- [ ] `pm2 status` on Throne shows expected processes online
- [ ] R2 (nightly-sync-audit routine) reports `critical: false` on next 4am run
- [ ] No new red Telegram alerts for 24h
