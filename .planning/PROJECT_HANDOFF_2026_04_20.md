# CRUZ / PORTAL · Complete Project Handoff — 2026-04-20

> Everything a new engineer (or future Claude session) needs to understand
> this codebase, its operations, and its state. Points to authoritative
> docs rather than duplicating them — but consolidates every thread.

---

## 1 · One-sentence summary

**CRUZ (brand: PORTAL)** is a cross-border customs-intelligence platform
built by **Renato Zapata & Company** (`Patente 3596 · Aduana 240 · Laredo,
TX · Est. 1941`) that replaces the manual workflow of a Mexican customs
broker with a Next.js + Supabase + Anthropic-powered portal, nightly/
intraday sync pipelines, and an agent layer that proposes actions for
human approval.

Two humans run it:
- **Renato Zapata III ("Tito")** — Director General · both US + Mexican
  customs broker licenses · final authority on every client-facing action
- **Renato Zapata IV** — Technical Operator · builds and deploys the
  platform · co-equal technical authority

One live client today: **EVCO Plastics de México** (`company_id='evco'`,
`clave_cliente='9254'`) · user is Ursula Banda. Accessed at
**portal.renatozapata.com**.

---

## 2 · The Three Standards (every feature evaluated against all three)

From CLAUDE.md — these are load-bearing invariants:

1. **11 PM Executive** — plant manager opens app, absolute certainty in
   under 3 seconds, closes app, sleeps. No drilling down required.
2. **SAT Audit** — Mexican tax authority audits. Immutable chain of
   custody. Every pedimento traceable. Append-only. Patente 3596
   protected.
3. **3 AM Driver** — World Trade Bridge, cracked Android, no signal,
   gloved hands. Sees lane number, goes. No reading. Touch targets ≥
   60px (not the WCAG 44px).

Any feature that fails any of the three fails all three.

---

## 3 · Stack · Top to Bottom

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER · portal.renatozapata.com                              │
│  · Next.js 15 App Router (React 19)                             │
│  · Tailwind · Geist + JetBrains Mono via next/font              │
└─────────────────────────────────────────────────────────────────┘
                               │ HMAC-signed session cookie
┌─────────────────────────────────────────────────────────────────┐
│  VERCEL (serverless)                                            │
│  · Next.js SSR + route handlers                                 │
│  · /api/* → lib/* → types/* (strict dependency flow)            │
│  · resolveTenantScope(session, req) is the single API-layer     │
│    tenant fence (src/lib/api/tenant-scope.ts)                   │
└─────────────────────────────────────────────────────────────────┘
                               │ service_role via @supabase/supabase-js
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE (Postgres · jkhpafacchjxawnscplf)                     │
│  · 8 globalpc_* tables (read-only mirror of GlobalPC MySQL)     │
│  · 4 econta_* tables (Anabel's accounting)                      │
│  · traficos · entradas · expediente_documentos · companies      │
│  · 7 storage buckets · RLS = `FOR ALL USING (false)` + service  │
│    role bypass (HMAC session is the tenant gate, not JWT claims)│
└─────────────────────────────────────────────────────────────────┘
                               │ MySQL replication / sync scripts
┌─────────────────────────────────────────────────────────────────┐
│  THRONE (local Mac Studio · 50.84.32.162 · PM2 daemon)          │
│  · 29 PM2 processes (see scripts/CRON_MANIFEST.md)              │
│  · GlobalPC MySQL (216.251.68.5:33033) — upstream truth         │
│  · eConta MySQL (:33035) — accounting upstream                  │
│  · Anthropic API (Sonnet/Haiku/Opus routing)                    │
│  · Qwen on local Ollama (bulk product classification)           │
└─────────────────────────────────────────────────────────────────┘
```

**Why this shape:** GlobalPC is the 20-year-old customs-ops system the
broker has always used. CRUZ cannot write to it (Mario @ GlobalPC must
not perceive CRUZ as competition — contract boundary). CRUZ mirrors it
read-only and adds the intelligence layer on top.

---

## 4 · The Five Surfaces

Every feature belongs to exactly one:

| Surface | Audience | Primary action | Access |
|---------|----------|----------------|--------|
| **Operator** | Juan José, Eloisa, Arturo | Process tráficos, capture pedimentos | Internal only (role=`operator`) |
| **Owner** | Tito, Renato IV | Approve drafts · Eagle View · QB export · admin view-as | Internal only (role=`admin` or `broker`) |
| **Shipper** (client) | EVCO Ursula · future MAFESA + 8 others | Track shipments · view A/R · chat | role=`client` (tenant-scoped) |
| **Supplier** | Duratech, Milacron, Foam Supplies | Submit docs · respond to solicitations | External (tokenized) |
| **Carrier** | Transport partners | Receive dispatch · update pickup | External (tokenized) |

**Client surface invariant:** No compliance anxiety. MVE countdowns,
missing-document warnings, semáforo holds stay internal. Client portal
shows certainty, not worry.

---

## 5 · Identity & session model

### Roles

| Role | Source | What it can do |
|------|--------|---------|
| `client` | `/api/auth/route.ts` login with clave + password | Sees own tenant only (HMAC signed · session.companyId) |
| `operator` | Internal Supabase user + role in `companies.portal_role` | Ops-wide reads; role-based writes |
| `contabilidad` | Anabel's role | `/contabilidad/*` cockpit |
| `broker` | Tito's role | Owner-level access · can use `/api/auth/view-as` |
| `admin` | Renato IV's role | Same as broker + can modify config |
| `owner` | Alias for `admin` in some checks | |

### Authentication

- **HMAC-signed session cookie** `portal_session` · NOT Supabase Auth JWT
- `src/lib/session.ts` · `signSession(payload)` + `verifySession(token)`
- Session contains `{ companyId, role, expiresAt }` · signed with
  `SESSION_SECRET` env var
- **RLS model:** all tables have `FOR ALL USING (false)` policies; the
  app uses `SUPABASE_SERVICE_ROLE_KEY` for server-side reads and the
  APP LAYER enforces `company_id = session.companyId` on every query

### Tenant resolution fence (SEV-1 contract)

`src/lib/api/tenant-scope.ts` · `resolveTenantScope(session, req)` is the
canonical single-source answer to "which companyId does this request
filter by?" Used by 10 API routes today:

```
client role   → session.companyId (cookie + param IGNORED)
internal role → ?company_id= param || company_id cookie || session
```

The internal cookie path exists specifically for `/api/auth/view-as` —
admin clicks "view as EVCO", the endpoint sets `company_id=evco` cookie,
downstream routes pick it up so the admin sees EVCO data.

Tests at `src/lib/api/__tests__/tenant-scope.test.ts` (23 assertions).

---

## 6 · Database model

### Tenant-scoped tables (must filter by company_id on every read)

```
globalpc_productos          · 149K rows · GlobalPC product mirror
globalpc_partidas           ·  22K rows · pedimento line items
globalpc_facturas           · mirror
globalpc_proveedores        · supplier mirror
globalpc_eventos            · event stream from GlobalPC
globalpc_contenedores
globalpc_ordenes_carga
globalpc_bultos
anexo24_partidas            · 1,793 EVCO rows · SAT Anexo 24 filings
traficos                    ·   3.4K rows for EVCO
entradas                    ·  20K rows for EVCO
expediente_documentos       · 214K rows (broker-wide)
pedimento_drafts            · Tito approves here
audit_log                   · append-only
```

### eConta (Anabel's accounting)

```
econta_facturas             · invoices we issue
econta_cartera              · A/R · powers /mi-cuenta
econta_ingresos             · payments received
econta_egresos              · payments out
econta_aplicaciones         · invoice/payment application
econta_anticipos            · client advances
econta_polizas              · journal entries
```

**Join key:** `econta_cartera.cve_cliente` → `companies.clave_cliente`
(4-digit broker code). NOT `company_id` directly.

### Non-tenant tables

```
companies                   · 30 rows · tenant directory
system_config               · 7 rows · regulatory rates (IVA, DTA, FX)
tariff_rates                · SAT IGI rates per fracción
heartbeat_log               · cron health
sync_log                    · sync run status
workflow_events             · CRUZ 2.0 event queue
api_cost_log                · Anthropic cost tracking per request
cruz_memory                 · 163+ learned patterns
```

### Indexes landed this session (2026-04-20, via `supabase db query --linked`)

```sql
idx_expediente_documentos_company_uploaded   (company_id, uploaded_at DESC)
idx_globalpc_productos_company_cve           (company_id, cve_producto)
idx_globalpc_partidas_company_cve            (company_id, cve_producto)
idx_globalpc_partidas_cve_producto           (cve_producto)
idx_entradas_company_fecha_llegada           (company_id, fecha_llegada_mercancia DESC)
idx_traficos_company_fecha_cruce             (company_id, fecha_cruce)
idx_globalpc_productos_classified_at         (company_id, fraccion_classified_at) WHERE NOT NULL
```

Plus `system_config.fx_savings_heuristic_pct` seed.

**Known schema drift (pre-existing):** migration_history table is empty
on remote while local has 142 migration files. Schema was built via SQL
Studio pastes over time. Not a functional blocker, but the next
`supabase db push` caller will hit 142 repair prompts. Cleanup = separate
block of work: audit each of the 142 against actual schema, repair
`applied` or `reverted` accordingly.

---

## 7 · Upstream data sources

### GlobalPC (read-only mirror)

- **MySQL** `bd_demo_38` @ `216.251.68.5:33033` · Throne IP whitelisted
- **Nightly sync:** `scripts/globalpc-sync.js` @ 01:00 Sun/Wed/Sat (full)
- **15-min delta:** `scripts/globalpc-delta-sync.js` (continuous)
- **Classification layer:** Qwen on local Ollama writes
  `globalpc_productos.fraccion_classified_at`
- **Contract:** READ-ONLY FOREVER. Mario Ramos (GlobalPC support) must
  not perceive CRUZ as competition. CRUZ is a quiet successor, not a
  replacement product. No writes back.

### eConta (Anabel's system)

- **MySQL** `bd_econta_rz` @ `:33035` · user `rep_rz`
- **Nightly full:** `scripts/full-sync-econta.js` @ 01:00 (via PM2
  `econta-nightly-full`)
- **Intraday every 30 min:** same script (via PM2 `econta-intraday`)
- **Weekly reconciler:** `scripts/econta-reconciler.js` @ Mon 04:00
- **Anabel cockpit:** `/contabilidad/inicio` — CxC aging 30/60/90+, CxP,
  MVE, QB export status
- **QB IIF generator** works at `src/lib/quickbooks-export.ts`
- **NOT DEPLOYED:** the PM2 script that pushes from
  `trafico_econta_exports` queue INTO eConta MySQL. Waits on Anabel's
  credential recon.

### Banxico (exchange rate)

- Pulled into `system_config.banxico_exchange_rate`
- Expires 2026-05-05 · will trigger warnings 2026-04-28

### SAT (regulatory)

- `SAT_RFC_API_URL` + `SAT_RFC_API_KEY` env vars — not yet set
- Cache + wiring live; feature dormant until creds arrive

### Anthropic

- Sonnet: invoice extraction, CRUZ AI responses, document analysis
- Haiku: product classification, semantic matching
- Opus: OCA opinions (rare, expensive)
- **Credit balance:** flagged in CLAUDE.md as needing topup

### Telegram

- Bot for pipeline/infrastructure alerts · NEVER for client comms
- Client-facing messaging uses Mensajería (internal channel)
- **Known leaked token** in `.aider.chat.history.md` (now untracked but
  in git history) — user chose to skip rotation; accept risk

---

## 8 · API surface

**230 route handlers** under `src/app/api/`. Every route handler follows:

```typescript
export async function GET(req: NextRequest) {
  const session = await verifySession(cookieToken)    // HMAC-verified
  if (!session) return 401
  const companyId = resolveTenantScope(session, req)  // THE fence
  if (!companyId) return 400
  // ... query with .eq('company_id', companyId) ...
}
```

### Categorized routes

**Auth:**
- `POST /api/auth` — login (clave + password → signed session)
- `POST/DELETE /api/auth/view-as` — admin impersonation (sets/clears
  `company_id` cookie)
- `POST /api/auth/logout`
- `POST /api/auth/change-password`

**Data:**
- `GET /api/data?table=X` — generic tenant-scoped read (primary
  dashboard data source)
- `GET /api/broker/data` — broker-cross-tenant aggregates (role=broker|admin only)
- `GET /api/catalogo/partes` — list a tenant's parts
- `GET /api/catalogo/partes/[cveProducto]` — deep parte view
- `GET /api/intelligence-feed` — compliance + anomaly + crossing signals
- `GET /api/cost-savings` — ROI calc for client
- `GET /api/launchpad` + `POST /api/launchpad/workflow` — Tito approvals

**Write/action:**
- `POST /api/ocr-classify` — document upload + AI classify
- `POST /api/cruz-chat` — CRUZ AI grounded in tenant context
- `POST /api/supplier-comms` — email supplier for docs
- `POST /api/drafts/recalculate` — recompute pedimento totals
- `POST /api/clasificar/apply` — apply fracción correction
- `POST /api/mensajeria/*` — in-app messaging layer

**Health:**
- `GET /api/health/data-integrity?tenant=evco` — traffic-light verdict
  (used by ship.sh gate 5)

### API isolation tests (regression fences)

| Route | Tests | File |
|---|---|---|
| `/api/broker/data` | 11 | role-fence.test.ts |
| `/api/intelligence-feed` | 6 | cookie-fence.test.ts |
| `/api/cost-savings` | 5 | cookie-fence.test.ts |
| `/api/supplier-comms` | 9 | cookie-fence.test.ts |
| `/api/launchpad` | 8 | cookie-fence.test.ts |
| `/api/cruz-chat` | 4 | cookie-fence.test.ts |
| `/api/catalogo/partes` | 9 | tenant-isolation.test.ts |
| `/api/catalogo/partes/[cveProducto]` | 8 | tenant-isolation.test.ts |
| `/api/data` | 10 | tenant-isolation.test.ts |
| `resolveTenantScope` helper | 23 | tenant-scope.test.ts |
| `/mi-cuenta` access contract | 20 | isolation.test.ts |
| `computeARAging` aging math | 8 | aging.test.ts |
| `getIVARate/getDTARates/getExchangeRate` | 11 | rates.contract.test.ts |

**~132 assertions** across these files specifically guard the
tenant-isolation invariants. 220 remaining routes use the same helper
but don't have dedicated tests yet — cloning the pattern to those is
straightforward follow-up work.

---

## 9 · PM2 / Cron inventory (Throne)

29 processes per `scripts/CRON_MANIFEST.md`. Summary:

| Class | Count | Representatives |
|---|---|---|
| Daemon (always-on) | 1 | cruz-bot (Telegram listener) |
| Continuous intake (≤30 min) | 5 | email-intake, globalpc-delta-sync, heartbeat, mensajeria-email-fallback, econta-intraday |
| Fast-cycle monitoring | 3 | semaforo-watch (5min), risk-scorer (2h), risk-feed (1h) |
| Daily ops | 12 | tito-daily-briefing (06:30), patentes-watch, vencimientos-watch, content-intel-cron, **system-config-expiry-watch** (new today, 07:15) |
| Weekly | 6 | globalpc-sync (Sun/Wed/Sat), econta-reconciler (Mon), seed-tariff-rates, backfill-*, full-sync-facturas |
| Twice-monthly | 1 | anexo24-reconciler (1st + 15th) |

### Alert coverage (ship-gated)

`scripts/alert-coverage-audit.js` runs on every ship. Baseline: 28 of
29 scripts have ≥ 3/4 signals (Telegram alert · process.exit(1) ·
heartbeat/sync_log write · main().catch). Only exception: `cruz-bot`
(daemon — different pattern).

### Known cron issues

- `seed-tariff-rates.js` uses `cve_trafico` column join — hardened with
  alert in this session but column name may still be wrong per
  CLAUDE.md known issues list. Next run 2026-04-26 Sun 03:00 will tell.
- `po-predictor.js` — CLAUDE.md flags outdated issues (pagination +
  `.insert().catch` bug). This session verified pagination + main().catch
  are correct; real gap was silent Telegram swallow, now fixed.

### Throne pm2 reload — **still outstanding**

The new `system-config-expiry-watch` cron is defined in
`ecosystem.config.js` but not yet loaded into PM2. Manual step:

```bash
ssh throne
cd ~/evco-portal && git pull   # pull the latest
pm2 reload ecosystem.config.js --only system-config-expiry-watch
pm2 save
pm2 status                     # verify 29 processes green
```

---

## 10 · Design system

**PORTAL** (current wordmark, Instrument Serif, letter-spacing 0.24em).

Brand lineage (for archaeology): CRUZ → ADUANA → AGUILA → ZAPATA AI
→ CRUZ → PORTAL (final · Block DD 2026-04-17). Internal component/CSS
namespaces (`AguilaMark`, `.aguila-canvas`, `--aguila-fs-*`) stay — they
predate the rename and renaming them is a separate refactor.

### Token contract

Every color/space/radius/shadow/duration/fs routes through
`--portal-*` vars in `src/app/portal-tokens.css`. Legacy `--aguila-*`
vars alias to `--portal-*` equivalents in the same file.

### Six principles

1. **Los números son el producto** — tabular, big, confident.
   JetBrains Mono on every figure/ID/timestamp.
2. **Emerald has one job** — `--portal-green-*` = "live/healthy" only.
   Never hover, never decoration.
3. **Surfaces stack** — 5 ink levels + hairlines 6–16% alpha.
4. **Ambient motion** — pulses + scan lines + breathing sparklines.
   All gated by `prefers-reduced-motion`.
5. **Monospace for metadata** — patente, fraction, ID, timestamp.
6. **Tradition + precision** — "Est. 1941" in footer, PORTAL wordmark.

### Class primitives

`.portal-btn`, `.portal-card`, `.portal-badge`, `.portal-input`,
`.portal-table`, `.portal-progress`, `.portal-pulse`, `.portal-scan`,
`.portal-grain`, `.portal-eyebrow`, `.portal-num` / `.portal-tabular`,
`.portal-kbd`, `.portal-metric`.

### Full spec

`.claude/rules/portal-design-system.md` (current canonical) +
`.claude/rules/design-system.md` (v5.0 legacy for non-migrated surfaces).

---

## 11 · Ship discipline

### The six gates (bash scripts/ship.sh)

| Gate | Checks |
|---|---|
| 1 · Pre-flight | typecheck · lint · vitest (all) · build · gsd-verify ratchets · block-audit · alert-coverage |
| 2 · Data integrity | `scripts/data-integrity-check.js` · 18 checks including Block EE invariants |
| 3 · Rollback bundle | `git bundle create ~/cruz-branch-backups/ship-<sha>-<ts>.bundle` |
| 4 · Vercel deploy | `vercel --prod --yes` |
| 5 · Live smoke | 3 curls · parses verdict from `/api/health/data-integrity` |
| 6 · Baseline snapshot | auto-writes `.claude/rules/baseline-YYYY-MM-DD.md` |

`npm run ship` runs all 6. `npm run ship:dry` runs 1-3 only.

### Ratchets (enforced in gate 1)

All defined in `scripts/gsd-verify.sh`. A ratchet is either:
- **target ↓** · baseline is current count · cannot grow, should shrink
- **enforced at 0** · hard invariant · any match fails ship

| Ratchet | State | What it guards |
|---|---|---|
| Hardcoded hex | 661 (↓ target) | no new colors outside design tokens |
| "CRUZ" in user-visible UI | 218 (↓) | brand rename hygiene |
| Inline @keyframes outside aguila/portal | 57 (↓) | motion centralization |
| Opaque glass / dark cards | 0 (enforced) | no `#111111` etc. |
| Console.error in src/app | 130 (↓) | structured logging |
| Role-from-cookie **(R15)** | 0 (enforced) | session-only role reads |
| scripts/ rate hardcodes **(R11)** | 0 (enforced) | refuse-to-calculate |
| /mi-cuenta calm tone **(R12)** | 0 (enforced) | ethics contract |
| scripts/ silent-catches **(R13)** | 153 (↓) | no silent failures |
| Alert coverage | baseline 28 of 29 (ship-gated) | cron failures visible |

### Baseline files

```
.claude/rules/baseline.md              (floor)
.claude/rules/baseline-2026-04-17.md   (Block EE ship)
.claude/rules/baseline-2026-04-19.md   (Contabilidad tile marathon)
.claude/rules/baseline-2026-04-20.md   (this session · I19-I27)
```

Each new baseline appends `**Superseded by:**` pointer to the prior one.
Never edit a prior baseline; always create a new file. Ratchet forward only.

---

## 12 · Test coverage (post-session)

```
Test Files  108 passed
Tests       904 passed
```

**Growth this session:** 667 → 904 (+237 tests added)

### Target-surface suites (MUST stay 100% green before any deploy)

Per `baseline-2026-04-17.md`:
- `src/lib/format/__tests__/company-name.test.ts` · 13 tests · legal-suffix stripping
- `src/app/inicio/__tests__/quiet-season.test.tsx` · 8 tests · 4-tile hero contract
- `src/lib/cockpit/__tests__/freshness.test.ts` · 7 tests · sync freshness bands
- `src/lib/cockpit/__tests__/nav-tiles.test.ts` · 11 tests · 6-tile nav contract

### This session's new fences (13 files · ~132 assertions)

See §8 table above.

---

## 13 · Known issues & outstanding tech debt

### Immediate (days)

1. **Throne pm2 reload** — `system-config-expiry-watch` not yet
   registered. Blocks the 2026-04-28 warning cycle for 2026-05-05
   rate expiry.
2. **Rate expiry 2026-05-05** — `iva_rate`, `dta_rates`,
   `banxico_exchange_rate`, `eta_model` all expire. Broker must refresh
   `valid_to` via SQL before then.
3. **Telegram bot token leaked** in git history. User chose to skip
   rotation. Recommendation stands: go to @BotFather → Revoke →
   update `.env.local` + Vercel env + `pm2 reload`. Old token in history
   becomes a dead string.

### Short-term (this week or next)

4. **Migration history drift** — 142 local migration files, 0 rows on
   remote history. Either run 142 repair commands (risky for
   future-dated files), or accept the drift. Doesn't block function.
5. **`any` triage** — 369 lint warnings remain (was 395). Target < 50.
   Most are no-unused-vars fixable with `_` prefix or deletion.
6. **Silent-catch ratchet R13 at 153** — non-cron scripts still have
   empty-catches. Target < 50.
7. **220 API routes without isolation tests** — 10 have dedicated
   fences; the rest rely on the `resolveTenantScope` helper but don't
   have per-route regression tests. Clone the pattern.

### Medium-term (this month)

8. **MAFESA onboarding** — runbook ready in `MAFESA_ONBOARDING.md`.
   Blocked on Tito's: RFC + clave_cliente + desired subdomain.
9. **eConta MySQL writer** — PM2 script from `trafico_econta_exports`
   queue not deployed. Waits on Anabel credential recon.
10. **WSDL Formato 53 method name** — Mario @ GlobalPC confirmation
    pending; `wsdl-anexo24-pull.js` falls back to inbox path.
11. **SAT RFC API creds** — `SAT_RFC_API_URL` + `SAT_RFC_API_KEY` unset.
12. **Anthropic credit topup** — CRUZ AI features graceful-fallback
    until topped up.
13. **Materialized view for /inicio** — not built. The 7 indexes
    landed today should cover most of the perf win; MV only worth it
    if /inicio FCP still > 500ms under multi-client load.
14. **Lighthouse CI** — not configured. Would enforce the per-route
    < 200 KB JS budget (CLAUDE.md §PERFORMANCE BUDGETS).

### Deferred (Month 2+)

15. **White-label (beyond MAFESA)** — 10 Tier 1 clients identified
    per CLAUDE.md (Faurecia, TS de San Pedro, Maniphor, Grupo Requena,
    MIMS, Hilos Iris, L Care, Worldtech, Empaques Litograficos,
    Maquinaria del Pacifico).
16. **Agentic 7.5 → 10** — CLAUDE.md says needs 60 days of earned trust.
    Weekly `/agent-audit` report on decision correction rate.
17. **Network intelligence** (Layer 5) — Month 6+ · anonymized cross-
    client patterns, Trade Index schema, first public data product.
18. **MCP server publish** — `scripts/cruz-mcp-server.js` is live with
    8 tools, tested against Claude Desktop. Publishing to MCP
    directories + X announcement pending.

---

## 14 · Credentials / integrations map

Everything under this heading is pointers — not the credentials
themselves. Credentials live in:
- `~/evco-portal/.env.local` (local dev)
- Vercel env vars (production)
- Throne `.env.local` (PM2 processes)

| Service | Key env var(s) | Notes |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Service role is server-side only |
| Session HMAC | `SESSION_SECRET` | Rotate = all sessions invalidate |
| Anthropic | `ANTHROPIC_API_KEY` | Sonnet/Haiku/Opus routing |
| Telegram (infra alerts) | `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID` | Rotate ASAP per §13.3 |
| Mensajería email | `RESEND_API_KEY` · `MENSAJERIA_FROM_EMAIL` | |
| GlobalPC MySQL | Throne-local (never in Vercel env) | Via PM2 sync scripts |
| eConta MySQL | Throne-local | Same |
| SAT RFC lookup | `SAT_RFC_API_URL` · `SAT_RFC_API_KEY` | Not yet set |
| Vercel CLI auth | `~/.vercel` on dev machine | Currently authed as `renatozapatabot-8218` |
| GitHub | `~/.ssh/id_ed25519` (verified today) | Authed as `renatozapatabot-star` |
| Supabase Management | `supabase/.temp/*` (after `supabase link`) | Project ref: `jkhpafacchjxawnscplf` |

**What rotates today** (should be automatic for a greenfield operation,
but this is a 2-person shop so it's manual):
- `banxico_exchange_rate` — daily via Banxico API (should be automated
  in cron but currently manual SQL update)
- SESSION_SECRET — NEVER rotated (would log out everyone); consider a
  rolling-secret scheme if session counts ever get into the thousands

---

## 15 · What happened 2026-04-19 → 2026-04-20 (this session)

42 commits landed across the branch `fix/pdf-react-pdf-literal-colors-2026-04-19`,
deployed to production at commit `1154626` via `vercel --prod`. HEAD on
GitHub (`renatozapatabot-star/evco-portal`): `1154626`.

### Major threads

1. **Lint cleanup** — 24 errors → 0 (ship gate unblock); 395 → 369 warnings
2. **Ethics contract test** — `/mi-cuenta/isolation.test.ts` (20 assertions)
   + primitive test `aging.test.ts` (8 assertions)
3. **Three anti-drift ratchets** — R11 (rate hardcodes), R12 (/mi-cuenta
   calm tone), R13 (silent catches)
4. **Operational docs** — CRON_MANIFEST (29 processes), MIGRATION_QUEUE,
   MAFESA_ONBOARDING, DEPLOY_RUNBOOK, two HANDOFF files
5. **Rate-hardcode sweep** — 4 files migrated to `getIVARate` /
   `getDTARates` / `getExchangeRate` with refuse-to-calculate
6. **Silent-catch sweep** — 3 cron-critical scripts (po-predictor,
   workflow-processor, cost-optimizer) + safe-write.js cleaned
7. **3 new migrations** — fx_savings_heuristic + 7 hot-path indexes
   — ALL APPLIED to prod today
8. **system_config expiry-watch** — new PM2 cron definition (needs
   reload on Throne)
9. **Alert-coverage audit tool** + ship-gate integration (28/29 baseline)
10. **Rates contract tests** (11 assertions · refuse-to-calculate proven)
11. **Tenant-isolation API fences** — 3 routes with 27 assertions
12. **MAFESA onboarding runbook** — 10-step runbook consolidating all
    fences
13. **Security sweep** — 13 SEV-1 forgery fixes across 10 API routes
14. **resolveTenantScope helper** — shared contract + 23-assertion test;
    restores admin view-as that the security sweep temporarily broke
15. **6 new regression tests** for the SEV-1 fixed routes
16. **First GitHub backup** — 17 branches + 8 tags pushed to
    `renatozapatabot-star/evco-portal` (private)
17. **Production deploy** — `vercel --prod` · `dpl_2mrmBNuVHpFUZFxZgMETdRmZbkFy`
    · live on portal.renatozapata.com

### The honest retrospective

Two course-corrections this session:
- **The audit agents hallucinated file paths.** Trust-but-verify caught
  it before any bad edit. `feedback_audit_agent_hallucinations.md`
  memory codifies this.
- **The security sweep over-corrected for internal roles** — removed
  the cookie path entirely, which broke admin view-as. Option-1 patch
  landed the `resolveTenantScope` helper that restores view-as without
  reintroducing the client-side forgery vector. Tests now cover both
  paths.

User explicitly chose to accept risks:
- Skip Telegram token rotation (leaked token remains in git history,
  will be dead only when user revokes via @BotFather)
- Skip manual view-as preview test before `vercel --prod`
- "Fix it later" — if any route fails in live usage, `vercel rollback`
  is the 5-second undo

---

## 16 · Runbooks (all in `.planning/`)

| Runbook | Purpose |
|---|---|
| `HANDOFF_2026_04_19_night.md` | Sunday-night state before the all-week push |
| `HANDOFF_2026_04_20.md` | Monday morning state (mid-session) |
| `DEPLOY_RUNBOOK_2026_04_20.md` | 9-step deploy guide (some steps now done) |
| `MAFESA_ONBOARDING.md` | Client #2 activation checklist |
| `PROJECT_HANDOFF_2026_04_20.md` | This file — complete handoff |

`.claude/rules/block-discipline.md` — the six-gate block convention that
every polish cycle follows.

---

## 17 · The codebase · file map

```
src/
  app/
    api/                  · 230 route handlers
      auth/*              · login + view-as + logout
      data/               · primary tenant-scoped read (most trafficked)
      catalogo/partes/    · parts list + detail
      health/             · data-integrity probe
      mensajeria/*        · internal comms layer
      [230 more]
    inicio/               · client cockpit · 4 hero KPIs + 6 nav tiles
    operador/inicio/      · operator cockpit · same shape, ops-wide scope
    admin/eagle/          · owner dashboard · broker-wide aggregate
    mi-cuenta/            · client A/R (feature-flagged)
    catalogo/             · parts explorer
    embarques/            · active shipments
    contabilidad/inicio/  · Anabel's cockpit
    login/                · the North Star (9.2/10 · intentionally gray CTA)
    [180 more pages]
  components/
    aguila/               · v6 primitives (KPITile, Sparkline, GlassCard, etc.)
    portal/               · Block DD design-system primitives (newer)
    ui/                   · shadcn/radix wrappers
    [180 more components]
  lib/
    supabase-server.ts    · createServerClient with session setting
    session.ts            · HMAC signSession/verifySession
    rates.ts              · getIVARate/getDTARates/getExchangeRate
    api/tenant-scope.ts   · **resolveTenantScope** — single API fence
    contabilidad/
      aging.ts            · computeARAging (primitive with 8-test coverage)
    cockpit/
      nav-tiles.ts        · UNIFIED_NAV_TILES + resolveNavHref
      freshness.ts        · sync-contract implementation
      safe-query.ts       · softCount/softData/softFirst wrappers
    aguila/
      tools.ts            · 8 CRUZ AI tools (execQueryCatalogo, etc.)
    format/
      company-name.ts     · cleanCompanyDisplayName (13-test coverage)
      pedimento.ts        · formatPedimento (DD AD PPPP SSSSSSS)
      fraccion.ts         · formatFraccion (XXXX.XX.XX)
    [many more]
  types/
    supabase.ts           · generated from live remote (11,255 lines)
    database.ts           · hand-maintained shared types

scripts/                  · 200+ scripts including:
  gsd-verify.sh           · 20+ ratchets · ship-gated
  ship.sh                 · 6-gate deploy pipeline
  alert-coverage-audit.js · silent-failure guard
  system-config-expiry-watch.js · proactive rate expiry alert
  CRON_MANIFEST.md        · 29 PM2 processes documented
  lib/
    rates.js              · CommonJS twin of src/lib/rates.ts
    telegram.js           · shared Telegram sender (infra alerts only)
    sync-log.js           · structured cron logging
    safe-write.js         · guarded Supabase writes
  [200 more scripts]

supabase/
  migrations/             · 142 SQL files (history drift with remote)
  MIGRATION_QUEUE.md      · applied vs pending tracker
  config.toml             · Supabase project config

.claude/
  rules/
    baseline.md                    · floor invariants (I1-I10)
    baseline-2026-04-17.md         · Block EE ship snapshot
    baseline-2026-04-19.md         · Contabilidad tile marathon
    baseline-2026-04-20.md         · This session (I19-I27)
    core-invariants.md             · 36 rules · every file edit loads these
    tenant-isolation.md            · Block EE contract · SEV-1 rules
    client-accounting-ethics.md    · /mi-cuenta ethics contract · §7 SEV-2
    portal-design-system.md        · Block DD canonical design rules
    design-system.md               · v5.0 legacy for unmigrated surfaces
    sync-contract.md               · 30-min freshness promise
    founder-overrides.md           · HARD/SOFT tier + override log
    ship-process.md                · six-gate deploy
    block-discipline.md            · every polish cycle convention
    parallel-sessions.md           · don't thrash when 2 Claudes run at once
    operational-resilience.md      · silent-failure rules
    supabase-rls.md                · RLS patterns
    cruz-api.md                    · route handler pattern
  agents/                  · aduanero, architect, reviewer subagents
  memory/
    learned-rules.md       · accumulated corrections
    corrections.jsonl      · raw correction log
    observations.jsonl     · pattern observations
  commands/                · /boot /review /fix-issue /evolve /audit /gsd:*

.planning/
  HANDOFF_*.md             · session-by-session state
  MAFESA_ONBOARDING.md     · client #2 runbook
  DEPLOY_RUNBOOK_*.md      · deploy procedures
  PROJECT_HANDOFF_*.md     · this file
  design-handoff/          · Block DD design reference (UI mockups)
  fixtures/                · test fixtures · sample invoices, pedimentos

ecosystem.config.js        · PM2 config · 29 processes
vercel.json                · Vercel deploy config
next.config.ts             · Next.js config
package.json               · npm scripts (dev, build, ship, lint, typecheck)
.gitignore                 · ignores .aider*, credentials/, .env*, etc.
```

---

## 18 · Roadmap

### This week
- Manual view-as smoke test on prod (user's hands)
- Rotate Telegram bot token
- Throne pm2 reload

### Before 2026-05-05 (must-do)
- Refresh `system_config` for `iva_rate`, `dta_rates`,
  `banxico_exchange_rate`, `eta_model` (new `valid_to`)
- expiry-watch will fire 🟢 heads-up 2026-04-28, 🟡 2026-05-02, 🔴 2026-05-05

### This month (May 2026)
- `any` triage push (369 → <50 warnings)
- Lighthouse CI
- More API isolation tests (cover the remaining 220 routes)
- MAFESA onboarding (when Tito supplies RFC + clave)
- 10 Tier 1 client trials
- Target: $3K–4.5K/month revenue

### Marathon 3 (quiet GlobalPC retirement · ~May 2026)
- 3-credential recon: Arturo AduanaNet + Anabel eConta + Tito GlobalPC
- First email-to-clearance through CRUZ end-to-end
- Transition from read-only mirror to primary system

### This quarter
- 30+ active clients
- Agentic 10/10 (Level 2 on multiple workflows)
- Phase 5 predictive features live
- Phase 6 network intelligence begins compounding

### This year
- 50+ clients
- White-label brokers
- Trade Index publishing
- Target: $100K/month revenue
- Two people. One Mac Studio. Patente 3596.

---

## 19 · Where to start if you're a new engineer

1. Read `CLAUDE.md` (the repo-local one, `~/evco-portal/CLAUDE.md`) —
   it's the constitution. 800 lines. Everything else grounds back here.
2. Read `.claude/rules/baseline-2026-04-20.md` — current invariant floor.
3. Read `.claude/rules/core-invariants.md` — 36 rules, loaded on every
   edit by all Claude sessions.
4. Skim `scripts/CRON_MANIFEST.md` — know what's running on Throne.
5. Skim `.claude/memory/learned-rules.md` — things corrected over time.
6. Run `bash scripts/ship.sh --skip-deploy` — should show all gates
   green. If not, that's the first thing to fix.
7. Run `node scripts/alert-coverage-audit.js` — know which crons are
   structurally sound.

**When Claude works on this repo:** it runs `/boot` at session start,
which reads CLAUDE.md + learned-rules.md + baseline. Don't skip this —
every rule exists because violating it caused a real regression,
compliance risk, or silent failure at some point.

---

## 20 · Contact & authority

- **Code authority:** Renato Zapata IV (Technical Operator). Email:
  `renatozapatabot@gmail.com`. GitHub: `renatozapatabot-star`.
- **Commercial / regulatory authority:** Tito (Renato III). Nothing
  client-facing ships without his sign-off.
- **Domain:** `renatozapata.com` — Patente 3596 · Aduana 240 · Laredo TX
- **Live URL:** `portal.renatozapata.com` (CNAME to Vercel)
- **Backup Vercel alias:** `evco-portal.vercel.app`
- **GitHub:** `https://github.com/renatozapatabot-star/evco-portal`
  (private · first-ever backup today)
- **Supabase project:** `jkhpafacchjxawnscplf`

---

## 21 · The One Rule

From CLAUDE.md: every decision evaluated against one question:

> **"Does this make the border more predictable for the people
> crossing it?"**

If yes, ship it. If no, don't. Patente 3596 riding on every pedimento.

---

*Codified 2026-04-20 · end of the all-week 10/10 push · 42 session
commits · first GitHub backup · live on production.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*
