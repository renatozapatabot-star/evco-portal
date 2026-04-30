# HANDOFF — Tuesday 2026-04-21 · MARATHON-10 · V2 Kickoff

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: ship the first net-new V2 features using the M9 foundation.
Zero EVCO-surface changes per the user's directive.

---

## One-line verdict

**V2 is operational.** The intelligence layer ships as a pure
library + API endpoint + operator dashboard. Two new primitives
land (StreakBar, InsightCard). White-label tenant config module
ships forward-compatible. Grok has everything needed to extend the
rule set, add new insight surfaces, or onboard a second tenant.

---

## Commits shipped (2 commits · 23e0b89..d3448b7)

| # | Commit | What |
|---|---|---|
| 1 | `d3448b7` | **intelligence layer + tenant config + 2 primitives** (1,831 insertions, 11 files) |
| 2 | (pending) | handbook §25 update + this handoff |

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1242 tests passing** (was 1215 · +27 net new) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 20 warnings (at-floor) |
| Pre-commit hook | green on every commit |

---

## What shipped this marathon

### 1. Intelligence layer — `src/lib/intelligence/crossing-insights.ts`

Pure module with three aggregators + one DB-facing orchestrator:

- **`computePartStreaks`** — per-SKU current + longest verde streaks,
  `just_broke_streak` flag for streaks broken in the last 30 days
- **`computeProveedorHealth`** — per-supplier verde/amarillo/rojo
  counts + `pct_verde` rate
- **`detectAnomalies`** — rule-based flags sorted by score:
  - `proveedor_slip` — verde rate dropped ≥ 10 pp week-over-week
    (requires ≥ 3 crossings each window + prior rate ≥ 70%)
  - `streak_break` — long (≥ 5) verde streak just broke
- **`getCrossingInsights`** — orchestrates partidas → traficos join
  → aggregation → shaped `InsightsPayload`

Tenant-scoped at query time (`company_id` on every `.eq()`). Graceful
fallback to empty payload on DB errors — never crashes the dashboard.

**16 unit tests** on the pure helpers — streaks/health/anomaly
detection + edge cases (insufficient samples, short streaks,
prior-rate gate, score ordering, Spanish copy format).

### 2. API endpoint — `GET /api/intelligence/insights`

Admin/broker only. First real consumer of the M9 foundation:
- Uses `requireAdminSession()` from `@/lib/auth/session-guards`
- Uses `ok()` / `validationError()` / `internalError()` from
  `@/lib/api/response`
- Admin override `?company_id=` for cross-tenant oversight; client
  sessions ignore
- Window bounded 7-365 days, default 90
- `Cache-Control: private, max-age=60, stale-while-revalidate=300`

### 3. Admin dashboard — `/admin/intelligence`

New operator-only route. Grok composed it entirely from the M9+M10
primitive library:

- 4-tile hero metrics (`<AguilaMetric>`)
- Four sectioned feeds:
  - Oportunidades · SKUs en racha verde (green tone)
  - Atención · Rachas rotas últimos 30 días (amber tone)
  - Salud de proveedores (top + watch · mixed tones)
  - Anomalías · reglas aplicadas (red tone when score ≥ 0.6)
- Window controls (30d / 90d / 180d) at the footer
- Calm empty-state with rule-sample explanation so an empty feed
  never looks broken

Has `loading.tsx` + `error.tsx` per the M5 boundary pattern.

### 4. Two new primitives

**`<AguilaStreakBar>`** (`src/components/aguila/AguilaStreakBar.tsx`)
- Horizontal row of colored dots (verde/amarillo/rojo)
- Newest-first, older dots fade slightly so the eye lands on the
  recent run
- `role="img"` + aria-label for a11y
- Tokens only — no hex

**`<AguilaInsightCard>`** (`src/components/aguila/AguilaInsightCard.tsx`)
- GlassCard variant for one signal
- Three tones (`opportunity` / `watch` / `anomaly`) set the ring
  color; background stays glass-neutral
- Calm-tone defaults — no pulsing, no emoji-bomb
- Optional eyebrow + body + visual slot + action CTA + meta
- Exported from the aguila barrel — composable with everything else

### 5. White-label foundation — `src/lib/tenant/config.ts`

**The module that makes V2 multi-tenant possible.**

`readTenantConfig(supabase, companyId)` returns a shaped
`TenantConfig` with:
- Identity (company_id, name, clave_cliente, rfc, patente, aduana)
- Language (es/en)
- `branding` — wordmark, logo_url, accent_token
- `features` — mensajeria_client, cruz_ai, mi_cuenta,
  white_label_surfaces

**Forward-compatible design:**
- `branding` + `features` are jsonb columns not yet in the
  companies migration. Parser tolerates absence + returns safe
  defaults.
- `accent_token` is validated against the `--portal-*` namespace
  — hex values rejected. Tokens-only rule holds in the feature-
  flag surface.
- `NEXT_PUBLIC_MI_CUENTA_ENABLED` env var honored as the mi_cuenta
  feature flag until the DB column lands.

Plus `hasFeature()` convenience helper so UI code can write
`if (await hasFeature(supabase, companyId, 'white_label_surfaces'))`.

**11 unit tests** covering: null row → stub, language defaults,
env-var honor, future-column tolerance, tokens-only validation,
garbage-blob handling.

---

## How V2 composes on top of M9

Every piece of M10 uses the M9 scaffolding:

| M9 foundation | M10 consumer |
|---|---|
| `requireAdminSession()` | `/api/intelligence/insights/route.ts` |
| `ok()` / `validationError()` / `internalError()` | same |
| `<GlassCard>` | `<AguilaInsightCard>` composes |
| M9 handbook §§18-24 patterns | `/admin/intelligence` page follows them all |

This is exactly the leverage the M9 refactor was for.

---

## Grok Handbook updated — §25 "V2 intelligence layer"

Five new sub-sections at the bottom of the handbook:

- §25.1 — The contract (three aggregators + anomaly kinds)
- §25.2 — How to add a new anomaly rule (4-step recipe)
- §25.3 — The two new primitives (one-line each)
- §25.4 — Tenant config with two code examples (branding + feature
  gates)
- §25.5 — M10 file inventory

Handbook now at 25 sections.

---

## What's intentionally NOT shipped

- **Real-time subscriptions.** Current dashboard re-fetches on
  navigation + 60s cache. Real-time would use Supabase Realtime on
  `traficos`; that's a Grok follow-up when the product needs it.
- **ML/predictive rules.** Only rule-based signals. ML belongs in
  a later phase with a proper training pipeline — not this marathon.
- **Cron-scheduled insights.** The module is lib-only; no PM2 cron
  writes into a cached table. Every `/api/intelligence/insights`
  call re-computes. Fine at current volume; adopt caching when it
  matters.
- **Companies table migration for `branding` + `features` jsonb
  columns.** The parser tolerates their absence. Add the migration
  when MAFESA has a first branding override to land. Until then,
  the scaffolding is in place.
- **EVCO surface changes.** Explicit directive from the user's brief.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline 23e0b89..HEAD                  # 2 commits
npm install
npx tsc --noEmit                                 # 0 errors
npx vitest run                                   # 1242/1242
bash scripts/gsd-verify.sh --ratchets-only       # 0 failures
```

Then visit `/admin/intelligence` in a browser (admin login) to see
the dashboard alive. With the sync ledger stale on Throne it'll
render the empty-state copy explaining the minimum-sample rules —
exactly as designed.

---

## The 10-marathon arc

| M | Delivery |
|---|---|
| M2 | Client acquisition engine |
| M3 | Activity timeline + sales assets |
| M4 | Lead → client conversion + Grok Handbook v1 |
| M5 | Demo-readiness audit + EVCO playbook |
| M6 | Ursula demo package |
| M7 | Catálogo parte-detail enrichment |
| M8 | Catálogo list semáforo + /inicio "verde" delight |
| M9 | Grok foundation (session-guards + ApiResponse + handbook §21-24) |
| **M10** | **V2 intelligence layer + tenant config + 2 new primitives** |

---

## What Grok can build next (V2 roadmap)

Using the M10 scaffolding, next high-leverage V2 adds:

1. **New anomaly rules** — plug into `detectAnomalies` per §25.2
   recipe. Ideas: fraccion_mismatch_spike, volume_surge, lead_time_drift
2. **Cron-scheduled intelligence** — PM2 job that computes insights
   nightly, writes to a cached `insights_snapshots` table
3. **Telegram/Mensajería hook** — subscribe to high-score anomalies,
   fire a summary to operators
4. **Client-facing intelligence surface** — gated behind
   `features.white_label_surfaces`; calmer tone than operator view
5. **MAFESA onboarding** — companies row + tenant config + branding
   JSON + feature flags = tenant #2 ready in a session, not a week
6. **AI-generated insight copy** — Sonnet takes the structured
   Anomaly + writes a natural-language brief. Feature-gated per tenant.
7. **Cross-tenant learning** — learned_patterns aggregate when
   `session.companyId === 'admin'`. The anonymization layer already
   exists in cruz_memory.

Each of these is 1-2 sessions of Grok work building on M10.

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
