# CRUZ — Master Context Document
**Last updated:** 7 April 2026 (evening session close)
**Maintained by:** Renato Zapata IV
**Status:** Living document. Read this BEFORE asking CRUZ to do anything.

---

## What CRUZ is

CRUZ is the operational intelligence layer for **Renato Zapata & Company**, a customs brokerage operating under Patente 3596, Aduana 240 Nuevo Laredo, established 1941. CRUZ does NOT replace the brokerage — it makes the brokerage autonomous, auditable, and measurably better than the human-only baseline.

**CRUZ is NOT a CRUD app. CRUZ is an event-driven multi-tenant agent platform with a 7-workflow pipeline that, when fully wired, processes shipments end-to-end from email arrival to invoice generation with human approval only on exceptions.**

Co-owners: Tito (Renato Zapata III) and Renato Zapata IV. Tito has absolute decision authority on customs matters; Renato IV builds the platform.

## Who CRUZ serves

**Active clients (in production):**
- EVCO Plastics de México (clave 9254) — primary client, contact Ursula Banda (Traffic Manager). 3,438 historical traficos. The pilot.
- MAFESA (clave 4598) — second client. 775 historical traficos.

**Hidden multi-tenancy:** The Supabase data layer is already serving **291 historical company identities** across the brokerage's 80-year history. The top 10 companies = 48% of all 30,657 traficos. The top 50 = 82%. The long tail of ~240 companies represents historical operations, dormant clients, test rows, and one-offs. Architecture decisions must be tenant-aware (per `company_id`), but day-to-day operational priority is EVCO and MAFESA only.

## The customs domain rules (NEVER VIOLATE)

These are absolute. They've been violated before and each violation cost real time to fix.

1. **Pedimento format:** `"AA ANAM XXXXXXXX"` — spaces preserved exactly
2. **Fracciones format:** `XXXX.XX.XX` — 8 digits, dots preserved, ALWAYS. Never 10 digits, never undotted, never 4 segments. Auto-classifier now enforces this via `normalizeFraccion()`.
3. **IVA base:** `valor_aduana + DTA + IGI` — never a flat 16% on the invoice value
4. **DTA:** Fixed fee per pedimento (462 MXN as of April 2026), NOT a percentage of value
5. **Currency labeling:** Every monetary field must explicitly label MXN or USD. Column names carry this (`importe_total`, `valor_dolares`, `valor_aduana`).
6. **Timezone:** UTC stored, America/Chicago displayed. No mixing.
7. **Client isolation:** `session.clientCode` is NEVER hardcoded. The real isolation key on `traficos` and `globalpc_productos` is `company_id`, NOT `client_id` (which is a constant identifying the brokerage). Cross-tenant queries are a hard violation.
8. **T-MEC detection:** Only apply IGI=0 if confirmed in `tariff_rates` data, NEVER from regime codes (ITE/ITR/IMD). Regime-based detection has been removed from Ghost Pedimento and must NOT be reintroduced.
9. **Silent failure unacceptable:** Every process reports health. `try { } catch { /* swallow */ }` is forbidden — at minimum, log to `console.error` AND write to a failure table.

## The data layer (the truth)

### Source-of-truth tables in Supabase

| Table | Rows | Purpose | Notes |
|---|---|---|---|
| `globalpc_productos` | 748,922 | The real source of truth for product → fracción mapping | 12.5% (93,426) classified, 87.5% unclassified. The classification target. |
| `globalpc_proveedores` | 1,971 | Supplier name decoder | Maps `cve_proveedor` (PRV_NNN) → human-readable `nombre`. Scoped per `cve_cliente`. |
| `traficos` | 30,657 | Shipment-level records from GlobalPC sync | 291 distinct `company_id` values. Has `predicted_*` columns that are 0% populated. |
| `partidas` | (unknown) | Line items per pedimento | ⚠️ Cannot be joined to `traficos` directly — `partidas.pedimento_id` is in SAT format (`"AA NN PPPP NNNNNNN"`), `traficos.pedimento` is bare sequence number. Different ingestion pipelines. |
| `entradas` | (~63K) | Inbound shipment notifications | 55K+ orphans linkable to traficos via `cve_embarque`. |
| `oca_database` | 1,921+ | AI classification audit trail | Written by `auto-classifier.js`. Until 7 April 2026, was a dead-end table that nothing read. |
| `api_cost_log` | 2,771+ | AI call cost tracking | Tracks Anthropic API spend. Query this for actual historical $. |
| `workflow_events` | 5,464 | The event bus | The spine of the 7-workflow pipeline. 96% are `entrada_synced` from `globalpc-delta-sync.js`. |
| `workflow_chains` | 9 rows | Routing rules | Defines which event in workflow A triggers which event in workflow B. |
| `operational_decisions` | 295 | Operational Brain decision log | 254 of 295 are `solicitation_overdue`. The Brain is alive but undernourished. |

### The PRV codes you have to know

Suppliers in `globalpc_productos` and `traficos` are stored as opaque codes like `PRV_5`, `PRV_526`, `PRV_2331`. The mapping table is `globalpc_proveedores`, and supplier codes are **scoped per client**: `(cve_cliente, cve_proveedor)` is the join key, never `cve_proveedor` alone. EVCO's PRV_5 is not the same as Vollrath's PRV_5.

`PRV_GENERICO` and `PRV_GENERICO_PR` are placeholder buckets for "miscellaneous supplier" — exclude them from supplier-pattern analysis or flag any prediction relying on them as low confidence.

### The 315K null-description problem

Of 748,922 products in `globalpc_productos`, approximately 315,000 have null `descripcion` — meaning they have product codes but no human-readable text to send to a classifier. These cannot be classified by AI until somebody enriches them, probably by pulling descriptions from GlobalPC MySQL `cb_producto` (Mario Ramos at GlobalPC controls that pipeline). This is a separate Block ("Block 0 — Description Enrichment") that must run before any large-scale classification backfill is worth doing.

## The architecture (what you forgot you built)

### The 7-workflow pipeline

CRUZ has an event-driven workflow system with 7 named workflows chained together:

```
intake → classify → docs → pedimento → crossing → post_op → invoice
```

Chain rules in `workflow_chains` define the transitions. The processor (`scripts/workflow-processor.js`, online in PM2 24/7) polls `workflow_events` for `pending` rows every 30 seconds, dispatches each to a handler, marks completed, and chains to the next workflow.

**Status as of 10 April 2026:** All 25 handler slots have real implementations. Zero stubs remain. The pipeline is fully wired. Next step: end-to-end testing with real EVCO data.

### The Operational Brain

Two modules form a "decision logging and event emission" layer:

- `scripts/decision-logger.js` writes to `operational_decisions` with structured fields: `decision_type`, `decision`, `reasoning`, `alternatives_considered`, optional `trafico` and `company_id`. It's the WHY log — what CRUZ decided and what it considered but rejected.
- `scripts/lib/workflow-emitter.js` writes to `workflow_events` via `emitEvent(workflow, eventType, triggerId, companyId, payload)`. Tenant isolation enforced at emit time.

Callers of `decision-logger`: `workflow-processor.js`, `auto-classifier.js`, `cruz-agent.js`, `zero-touch-pipeline.js`, `solicit-missing-docs.js`, `predictive-classifier.js`, `crossing-predictor.js`.

Callers of `workflow-emitter`: `email-intake.js`, `globalpc-delta-sync.js`, `auto-classifier.js`, `zero-touch-pipeline.js`, `carrier-ai-coordinator.js`, `solicit-missing-docs.js`, `status-flow-engine.js`, `cruz-crossing.js`.

### The fleet (PM2 + crontab hybrid)

CRUZ has **248 .js files in `scripts/`** — only 8 are in PM2. The CLAUDE.md says "PM2 for everything" but reality is a hybrid:

**PM2 always-online (3):** `cruz-bot` (telegram), `fold-agent`, `workflow-processor`
**PM2 cron (5):** `cruz-crossing` (every 15min), `cruz-closeout` (every 30min), `cruz-touch-monitor` (every minute), `clearance-sandbox` (5 AM daily), `wsdl-document-pull` (3 AM daily)
**System crontab (~6 production scripts invisible to PM2):** `email-intake.js`, `banxico-rate.js`, `shadow-reader.js`, `doc-classifier.js`, `regression-guard.js`, `fetch-bridge-times.js`
**NPM script only (87):** Manual invocation via `npm run X`
**Ghost — exists but unscheduled (158):** Includes ~30 intentional one-shots (bootcamp/backfill/fix), ~20 production scripts that run via crontab (invisible to PM2), and ~108 aspirational intelligence modules

### Stack and infrastructure

- **Frontend/portal:** Next.js, TypeScript, Tailwind, Geist font, JetBrains Mono for numerics
- **Backend:** Supabase (`jkhpafacchjxawnscplf.supabase.co`)
- **Source data:** GlobalPC MySQL (`216.251.68.5:33033`, db `bd_demo_38`) — Mario Ramos controls whitelist
- **Process management:** PM2 on Throne (Mac Studio at `192.168.2.215`)
- **AI:** Anthropic API — Claude Sonnet 4.6 for reasoning, Claude Haiku 4.5 for classification, ~$0.0030 per classification measured 7 April 2026
- **Local AI option:** Ollama installed but `ollama serve` not running. Available as fallback if Haiku cost becomes prohibitive.
- **Telegram:** `@cruz_rz_bot`, RZ Ops group `-5085543275`. Tito ID `8538502098`, Renato IV ID `7277519813`.
- **Deploy:** `vercel --prod --force` from `~/evco-portal`
- **Domain:** `evco-portal.vercel.app` (login: `evco2026` / `mafesa2026`)

## The design system (locked)

```
Background:    #FAFAF8  (all portal pages)
Dark surface:  #0D0D0C  (login + /cruz only)
Gold accent:   #C9A84C  (decorative only, never load-bearing)
Gold text:     #8B6914  (WCAG AA)
Body font:     Geist
Numerics:      JetBrains Mono (ALL numbers, dates, IDs, fracciones)
Touch target:  60px minimum (not 44px — broker hands, gloves possible)
Locale:        es-MX exclusive in client-facing UI
```

**Badge semantics:**
- amber = En Proceso
- orange = Retrasado
- green = Cruzado / Pagado
- gray = Pendiente
- **red = ERROR ONLY** (never used for warnings, never for "needs attention," never for urgency)

## The client isolation rule, restated

The brokerage operates 2 active clients (EVCO, MAFESA) with the architecture supporting 291. Every query, every UI surface, every script must filter on `company_id` (not `client_id`, which is a brokerage-level constant). The 4 routes in `src/app/api/` that take operator-supplied `client_id` from the request body or URL params are a hard violation — they must read tenant from the auth context, never from user input.

## Known broken / partially built things

**Bugs fixed (10 April 2026):**
- ~~`predictive-classifier.js` line ~106: undefined variable `tc`~~ FIXED — renamed to `exchangeRate`
- ~~`predictive-classifier.js` T-MEC logic uses regime codes~~ FIXED — removed regime-based detection
- ~~`auto-classifier.js` `top` reference before declaration~~ FIXED 7 April 2026
- ~~`auto-classifier.js` no tenant scoping in historical matching~~ FIXED 7 April 2026
- ~~`auto-classifier.js` writes only to dead-end `oca_database`~~ FIXED 7 April 2026
- ~~`auto-classifier.js` no batch mode~~ FIXED 7 April 2026
- ~~`auto-classifier.js` format inconsistency in fracción field~~ FIXED 7 April 2026 via `normalizeFraccion()`
- ~~All 13 workflow handler stubs~~ WIRED 10 April 2026

**Known classification quality issues (not yet fixed):**
- Polymer chapter discrimination: classifier confuses 3907 (polycarbonate) with 3908 (polyamide/nylon). Needs prompt examples.
- Description-vs-history conflict: classifier over-trusts historical patterns even when description contradicts (bamboo spatula classified to plastic chapter 3924 instead of wood chapter 4419). Needs prompt-level consistency check.

## Key reference numbers

| Metric | Value |
|---|---|
| Total traficos | 30,657 |
| Distinct companies | 291 |
| Top 10 companies | 48% of volume |
| Top 50 companies | 82% of volume |
| Total products in `globalpc_productos` | 748,922 |
| Products with fracción assigned | 93,426 (12.5%) |
| Products classifiable (with description) | ~340,000 |
| Products with null description | ~315,000 |
| Suppliers in `globalpc_proveedores` | 1,971 |
| Total scripts in `scripts/` | 248 |
| PM2 always-online | 3 |
| PM2 cron | 5 |
| Crontab production scripts | ~6 |
| Ghost scripts | 158 |
| Workflow events recorded | 5,464 |
| Workflow chain rules | 9 |
| Workflow handler stubs remaining | 0 (all wired 10 April 2026) |
| Operational decisions logged | 295 |
| AI calls historically logged | 2,771 |
| Cost per AI classification | $0.0030 (measured 7 April 2026) |
| Estimated cost for full classifiable backfill | ~$1,020 |

## Definition of done (the two simultaneous truths)

CRUZ is "done" when both of these are true on the same day:

1. **EVCO plant manager opens dashboard at 11 PM. Sees certainty. Closes app. Sleeps.**
2. **Tito reviews real draft. Corrects something. Taps approve. Sees "Patente 3596 honrada. Gracias, Tito." Says "está bien."**

Not a demo. A real pedimento. A real broker. A real clearance.

## What to NEVER do

- Hardcode `9254`, `EVCO`, `4598`, or `MAFESA` in any query
- Filter by `client_id` thinking it's the tenant key (it's the brokerage constant)
- Use regime codes for T-MEC eligibility detection
- Write fracciones in any format other than `XXXX.XX.XX`
- Use red color for anything except errors
- Use `tc` as a variable name for exchange rate (use `exchangeRate`)
- Wrap async calls in `.catch(() => {})` without at least logging
- Add a script to `scripts/` without scheduling it in PM2 or crontab
- Ship a "fix" to `auto-classifier.js` without re-running the 50-row EVCO test batch
- Refer to CRUZ as "CRUD"

## What to ALWAYS do

- Read this document before starting any new build
- Filter by `company_id` for tenant scoping
- Verify schema with a sample query before writing JOIN logic
- Check `pm2 list` AND system crontab when looking for "what's running"
- Run `pnpm typecheck` before declaring any TypeScript work done
- Wrap new scripts in observability (`runJob()` once Block 1 ships)
- Test classification fixes against the 50-row EVCO eyeball batch
- Get Tito's approval before any decision over $500 in AI spend
- Update this document when reality changes
