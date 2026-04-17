# CRUZ Ship Process — six-gate audit → deploy → baseline

Single command: `npm run ship` (or `bash scripts/ship.sh`).
Dry-run (gates 1–3, no deploy): `npm run ship:dry`.

This file is the authoritative definition. If the script drifts from
this doc, the doc wins — update the script.

---

## Why this exists

Before this process: every deploy was a manual chain of
`tsc + build + vitest + gsd-verify + data-integrity-check + vercel + smoke`
done by muscle memory. On 2026-04-17 we shipped a regression that left
Ursula's cockpit rendering zeros for three hours because one of those
steps was skipped.

The six gates below encode what the muscle memory did well AND close
the holes where it failed (silent soft-query zeros, no live data-
integrity probe post-deploy, no auto-baseline writer).

---

## Gates

### 1. Pre-flight (static + tests)

| Check | Command | Fails on |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | any type error |
| Full vitest | `npx vitest run` | any failing test that wasn't pre-existing |
| Production build | `npm run build` | Next.js build error |
| Ratchet gates | `bash scripts/gsd-verify.sh --ratchets-only` | any ratchet violation |

Output summaries piped to `/tmp/cruz-ship-*.log`; full logs attached to
the Telegram alert on failure.

### 2. Data-integrity smoke (local DB probe)

`node scripts/data-integrity-check.js` — 18 checks including the
post-2026-04-17 EVCO-cockpit guard (every nav-card table must have
>0 rows in the 365-day window).

### 3. Rollback bundle

`git bundle create ~/cruz-branch-backups/ship-<short-sha>-<ts>.bundle <branch>` —
always runs, always succeeds. Filename makes the mapping deploy ↔ bundle
obvious when triage needs a one-step revert.

### 4. Vercel deploy

`vercel --prod --yes`. Parses the deployment URL from stdout; if
parsing fails → treat as deploy failure.

### 5. Live smoke (post-deploy)

Three live curls:

1. `GET https://portal.renatozapata.com/` → expect 307 or 200.
2. `GET https://evco-portal.vercel.app/` → expect 307 or 200.
3. `GET https://portal.renatozapata.com/api/health/data-integrity`
   → parse `verdict` field.

Verdict handling:

| Verdict | Action |
|---|---|
| `green` | Proceed to gate 6 |
| `amber` | Warn but continue (stale tenant window, not broken) |
| `red`   | STOP — deploy is live but data is wrong. Investigate before any Telegram "ship complete" message |

### 6. Baseline snapshot

Auto-writes `.claude/rules/baseline-YYYY-MM-DD.md` with:
- Branch, head commit, short SHA, timestamp
- Deploy URL
- Test counts (from gate 1)
- Live integrity JSON (from gate 5)
- Rollback bundle path (from gate 3)
- Carry-forward invariants from the prior baseline + new ones this ship introduces

Appends a `**Superseded by:** baseline-YYYY-MM-DD.md` pointer to the
previous canonical `baseline.md`. The ratchet only goes forward.

---

## Failure modes + recovery

| Gate | Failure → do what |
|---|---|
| 1 | Fix locally, rerun. No deploy happens. |
| 2 | Check `/tmp/cruz-ship-integrity.log`. If an EVCO table returns 0 rows in window, probe Supabase directly before proceeding. |
| 3 | Disk full or git bundle corruption → investigate before any future deploy. |
| 4 | Vercel failure → check Vercel status, retry. |
| 5 red | `vercel rollback` immediately. The aliasing is already live but the cockpit is broken. File a SEV-2 incident in LEARNINGS.md. |
| 6 | Baseline write failure is non-fatal for the deploy but blocks the Telegram success message. |

---

## What `--skip-deploy` is for

- Pre-push sanity checks on a feature branch.
- Verifying the test suite + build + integrity before a PR opens.
- Onboarding a new tenant — you want to know the data is there before
  hitting Vercel.

Gates 1–3 only; gates 4–6 skipped. Exit code is still 0 on success so
CI can gate a PR on it.

---

## Out of scope (for now)

- **Auto-rollback on red verdict at gate 5.** Script exits non-zero;
  operator runs `vercel rollback` manually. Auto-rollback needs a
  Vercel API token + decision policy and lands in a follow-up.
- **Telegram success pings.** The script logs; the Telegram emitter
  hook (`dispatchTelegramForEvent('deploy_success', …)`) is a follow-up
  once the telegram_routing table has the event kind registered.

---

## Definition of "green ship"

All six gates green + baseline file written + rollback bundle present.
Missing any of those three = incomplete ship. Don't report success to
the user (or Tito) until all three are true.
