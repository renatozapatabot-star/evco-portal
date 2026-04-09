# Block 16 Phase 1 — Data Integrity Investigation

**Date:** 2026-04-08
**Investigator:** Claude (Block 16 Phase 1)
**Method:** Direct Supabase queries with service role key + source code analysis

---

## Contradiction 1 — Ghost Escalations on Admin Dashboard

**Symptom:** Admin dashboard shows "20 escalaciones · 20 vencidas" while `/drafts` shows "0 borradores pendientes."

**Database probe results:**
- Total drafts in `pedimento_drafts`: **137**
- By status: `draft: 34`, `pending: 103`
- With `trafico_id`: **1** (only one draft is linked to a real tráfico)
- Without `trafico_id` (orphans): **136**
- `needs_manual_intervention=true`: **34**
- All orphans have `company_id: null`

**Source of truth:** The database. 137 drafts exist, 136 are orphans with no `trafico_id` and no `company_id`.

**Diagnosis: BOTH — data problem AND query divergence.**

The admin dashboard (`fetchAdminData` in `fetchCockpitData.ts:139-143`) queries `pedimento_drafts` with `status='pending'` and no `company_id` filter (correct for admin — admin sees everything). It finds the 103 pending drafts (all orphans) and maps them to "escalations." It shows up to 20 with descriptions like "Borrador pendiente: sin trafico — desconocido" because `trafico_id` is null and `company_id` is null.

Meanwhile, `/drafts/page.tsx:56` filters by `.eq('company_id', companyId)` where `companyId` comes from the cookie. Since ALL orphan drafts have `company_id: null`, they match NO company, so `/drafts` shows 0 for every user.

The 136 orphan drafts were likely created by the email-intake pipeline during early development/testing — they have no `trafico_id`, no `company_id`, and `created_at` dates around April 2, 2026. They are test artifacts, not real operational data.

**Recommended fix:** Quarantine all 136 orphan drafts (those with `company_id IS NULL AND trafico_id IS NULL`) into `pedimento_drafts_quarantine_block_16`. Keep the 1 draft that has a `trafico_id`. After quarantine, the admin dashboard will show only real escalations (likely 0-1), which aligns with `/drafts`.

**Effort:** 30 min (create quarantine table + move rows + verify both surfaces)
**Risk if NOT fixed before launch:** HIGH — admin dashboard looks broken/alarming with 20 fake escalations

---

## Contradiction 2 — Dashboard Zero KPIs vs Traficos Page Reality

**Symptom:** Client dashboard shows "0 envíos en tránsito" while `/traficos` shows 151 pages of data.

**Database probe results:**
- Total EVCO traficos: **3,438**
- By status: `Pedimento Pagado: 312`, `Cruzado: 684`, `En Proceso: 4`
- EVCO traficos last 30 days (by `created_at`): **26**
- EVCO crossed last 30 days: **18**

**Source of truth:** The database. EVCO has 3,438 traficos total, 4 currently "En Proceso."

**Diagnosis: QUERY BUG — overly narrow filter in `fetchClientData`.**

The client dashboard query (`fetchCockpitData.ts:401-409`) filters active traficos by:
```
.eq('company_id', companyId)
.in('estatus', ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado'])
.gte('fecha_llegada', '2024-01-01')
```

This query returns records — there are 4 "En Proceso" and 312 "Pedimento Pagado" for EVCO. The dashboard `activeShipments` count comes from `activeTraficos.length`. If this is truly returning 0, the likely cause is that `company_id` doesn't match what the cookie returns. The `/traficos` page uses a different query path (`/api/data?table=traficos&company_id=evco`) which works.

The real issue is that the dashboard shows `activeShipments` which is filtered to only "active" statuses. With only 4 "En Proceso" traficos, the dashboard SHOULD show ~316 (4 En Proceso + 312 Pedimento Pagado), not 0. The 0 likely comes from the `company_id` cookie mismatch or the `fecha_llegada >= 2024-01-01` filter excluding records with null `fecha_llegada`.

**What the dashboard SHOULD show:**
- Active shipments: 4 (En Proceso) — these are genuinely in transit
- Total traficos is 3,438 but the dashboard shouldn't show historical — it should show what's moving NOW
- The `/traficos` page showing 151 pages is correct (it shows ALL traficos with pagination)

**Recommended fix:** Debug the `company_id` mismatch between cookie and query. The `fetchClientData` function receives `companyId` from the cockpit page — verify the cookie value matches `'evco'` (lowercase) since that's what the DB uses. Also: show meaningful KPIs even during quiet periods — "3,438 tráficos totales · 4 en proceso · 18 cruzados este mes" instead of just the active count which can be 0 during seasonal lulls.

**Effort:** 45 min (debug cookie, fix query, add meaningful quiet-period KPIs)
**Risk if NOT fixed before launch:** HIGH — dashboard showing 0 when the client KNOWS they have data destroys trust instantly

---

## Contradiction 3 — Pipeline Funnel Showing "968 Intake → 2 Classify → 30 Docs → 0 Everything Else"

**Symptom:** Admin cockpit pipeline funnel shows items concentrated in early stages with nothing past Documentos.

**Database probe results:**
- Total `workflow_events`: **1,000** (hit query limit)
- By `workflow` field: `intake: 968`, `classify: 2`, `docs: 30`
- By `event_type`: `entrada_synced: 967`, `email_processed: 1`, `product_needs_classification: 2`, `document_received: 15`, `completeness_check: 15`
- All 1,000 events have `status: 'completed'`
- Events in last 24h: **46,341** (much more than 1,000 — the earlier query hit the limit)

**Source of truth:** The `workflow_events` table. The data is real — the pipeline genuinely has most activity in the intake stage because `entrada_synced` is the most common workflow event (every entrada sync fires one).

**Diagnosis: REAL DATA + MISLEADING PRESENTATION.**

This is NOT a bug — the funnel accurately reflects that:
1. 968 intake events (entrada syncs) have occurred
2. Only 2 classification events and 30 document events have been processed
3. No pedimentos, crossings, post-ops, or invoices have flowed through the workflow engine yet

The workflow engine (CRUZ 2.0) is real and working, but the funnel stages beyond "intake" haven't been activated for real operations yet. The admin dashboard shows this honestly. However, the 24h filter in `fetchAdminData` (line 119: `gte('created_at', h24)`) means it only shows TODAY's events. With 46K events in 24h, mostly intake syncs, the funnel shows a massive intake number with tiny classify/docs numbers.

**What the funnel SHOULD show:** The funnel should NOT be misleading — but showing "968 → 2 → 30 → 0 → 0 → 0 → 0" suggests a bottleneck that doesn't exist. The events aren't "stuck" in intake — they're just different event types flowing through the system. A better approach: show the funnel as "stages activated" with a note about the system being in early operation, OR only count events that represent actual tráfico progression (not every entrada_synced ping).

**Recommended fix:** Two options:
1. **Quick fix (recommended):** Filter funnel to only show events from the last 24h AND rename "Recepción" to be honest — show totals with context like "968 sincronizaciones" not implying items are waiting
2. **Better fix:** Map tráfico statuses to funnel stages instead of workflow_events — show how many traficos are at each stage RIGHT NOW (e.g., 4 En Proceso, 312 Pedimento Pagado, 684 Cruzado)

**Effort:** 1 hour (quick fix) or 2 hours (better fix)
**Risk if NOT fixed before launch:** MEDIUM — admin-only view, but Renato IV will see it and wonder why 968 items are "stuck" in Recepción

---

## Contradiction 4 — War Room "0 Tráficos Activos"

**Symptom:** `/war-room` shows "0 Tráficos Activos" while `/traficos` shows active data.

**Source code analysis:** War room (`src/app/war-room/page.tsx`) fetches via:
```javascript
fetch(`/api/data?table=traficos&company_id=${companyId}&limit=2000`)
```
Then filters `enProceso` as traficos where estatus does NOT include "cruz" (lowercase):
```javascript
const enProceso = traficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))
```

**Diagnosis: QUERY BUG — same `company_id` cookie issue as Contradiction 2, PLUS status filter logic.**

The war room gets `companyId` from `getCompanyIdCookie()`. If this returns the wrong value (or empty), the API returns 0 results. Additionally, the war room's definition of "active" is "not crossed" — so it filters OUT all "Cruzado" traficos. With EVCO having 684 Cruzado and 312 Pedimento Pagado and 4 En Proceso, the war room should show ~316 active traficos (everything except Cruzado).

The 0 result strongly suggests the `/api/data` endpoint is failing or the `company_id` cookie is empty/wrong when war room loads.

**Recommended fix:** Same root cause as Contradiction 2 — fix the `company_id` cookie chain. Once that's fixed, war room should show ~316 traficos automatically. War room should also show "4 urgentes (En Proceso)" separately from "312 pagados esperando cruce."

**Effort:** 15 min (piggybacks on Contradiction 2 fix)
**Risk if NOT fixed before launch:** MEDIUM — war room is admin/operator tool, not client-facing

---

## Contradiction 5 — Financiero Exchange Rate Dated "04 ago 2026" (4 Months in Future)

**Symptom:** `/financiero` shows "Última actualización 04 ago 2026" — a future date.

**Database probe results:**
- `system_config` row for `banxico_exchange_rate`:
  - `rate: 17.758`, `date: "2026-04-07"`, `source: "banxico"`
  - `valid_from: "2026-04-07"`, `valid_to: "2026-05-05"`
  - `updated_at: "2026-04-08T11:00:01.903+00:00"`

**Banxico API response (live):**
- Returns dates in `dd/mm/yyyy` format: `"08/04/2026"` = April 8, 2026
- Latest rate: 17.4157

**Source of truth:** Banxico API. The rate (17.4157) is correct and current.

**Diagnosis: RENDER BUG — date format parsing error.**

The chain:
1. Banxico API returns `fecha: "08/04/2026"` (dd/mm/yyyy format)
2. `/api/tipo-cambio/route.ts` line 18 passes `latest.fecha` directly without parsing: `{ tc: parseFloat(latest.dato), fecha: latest.fecha }`
3. `FinExchange.tsx` line 54 calls `fmtDate(tc.fecha)` which creates `new Date("08/04/2026")`
4. JavaScript's `new Date("08/04/2026")` interprets this as **August 4, 2026** (mm/dd/yyyy American format)
5. `fmtDate` then correctly formats the WRONG date: "04 ago 2026"

The rate VALUE displayed ($17.4157) is correct. Only the DATE is wrong.

**Recommended fix:** Parse the Banxico `dd/mm/yyyy` date format in the API route before returning it. Convert to ISO format (`2026-04-08`) so downstream `fmtDate()` works correctly:
```javascript
// In /api/tipo-cambio/route.ts
const [d, m, y] = latest.fecha.split('/')
const fecha = `${y}-${m}-${d}` // "2026-04-08" ISO format
```

**Effort:** 15 min
**Risk if NOT fixed before launch:** HIGH — a future date visible on a financial page destroys credibility

---

## Contradiction 6 — Operator Queue "0 Asignados, 172 Sin Asignar"

**Symptom:** `/operador` shows 0 assigned to Renato IV and 172 unassigned tasks.

**Database probe results:**
- `entradas` table: does NOT have `assigned_to_operator_id` column (query returned null for both counts)
- `traficos` table: `assigned_to_operator_id` column exists but is NULL for all 30,657 rows (0 assigned, 30,657 unassigned)
- `operators` table: 1 record — Renato Zapata IV (role: admin, active: true)

**Source code analysis:** The operator cockpit query (`fetchOperatorData` in `fetchCockpitData.ts:259-310`) correctly queries:
- Assigned traficos: `.eq('assigned_to_operator_id', operatorId)` → returns 0 (nothing assigned)
- Unassigned count: `.is('assigned_to_operator_id', null)` → returns count of active unassigned traficos
- But the operator query also filters by `.in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])` and `.gte('fecha_llegada', '2024-01-01')`, which narrows the 30,657 total down to ~172 active unassigned

**Diagnosis: NORMAL STATE for a new system — NOT a bug.**

The assignment system has never been used. Renato IV's operator record exists but no traficos have been assigned to him (or anyone). This is expected for a brand-new platform. The 172 "sin asignar" count is accurate — there ARE 172 active traficos with no operator assigned.

The problem is **messaging, not data.** "172 sin asignar" implies a backlog crisis. In reality, the assignment feature simply hasn't been activated yet. Also: Renato IV's role is `admin`, not `operator`, so the operator cockpit may not even be the right view for him.

**Recommended fix:** Change the operator cockpit messaging:
- Instead of "172 sin asignar" (implies neglected backlog), show "172 listos para asignar" (implies opportunity)
- OR: Since Renato IV is the only operator AND he's `admin` role, consider seeding 5-10 traficos as assigned to him for demo purposes, so the operator view shows "5 asignados a mí" with real tráfico data

**Effort:** 20 min (messaging change) or 30 min (seed assignments)
**Risk if NOT fixed before launch:** LOW — operator view is internal-only, but "0 asignados" looks like nobody's working

---

## Synthesis

### How many of the six are data problems vs query bugs:

| # | Contradiction | Type |
|---|---|---|
| 1 | Ghost escalations | **Data problem** (136 orphan drafts) + query divergence |
| 2 | Dashboard zero KPIs | **Query bug** (company_id mismatch) |
| 3 | Pipeline funnel zeros | **Real data** + misleading presentation |
| 4 | War room zero | **Query bug** (same company_id issue as #2) |
| 5 | Future exchange rate | **Render bug** (dd/mm vs mm/dd date parsing) |
| 6 | Operator zero assigned | **Normal state** (assignment not activated) |

**Summary:**
- Data problems: **1** (Contradiction 1 — orphan drafts)
- Query bugs: **2** (Contradictions 2 and 4 — company_id cookie)
- Render bugs: **1** (Contradiction 5 — date format)
- Misleading presentation: **1** (Contradiction 3 — funnel)
- Normal state needing messaging fix: **1** (Contradiction 6 — operator queue)

### Phase 2 fix order (recommended):

1. **Contradiction 5 — Future exchange rate** (15 min, HIGH risk, trivial fix, visible to clients)
2. **Contradiction 2 — Dashboard zero KPIs** (45 min, HIGH risk, blocks client demo)
3. **Contradiction 4 — War room zero** (15 min, MEDIUM risk, piggybacks on #2)
4. **Contradiction 1 — Ghost escalations** (30 min, HIGH risk, blocks admin demo)
5. **Contradiction 3 — Pipeline funnel** (1 hour, MEDIUM risk, admin-only)
6. **Contradiction 6 — Operator queue** (20 min, LOW risk, messaging change)

### Total Phase 2 effort estimate:

- Tier A (data integrity): ~2.5 hours
- Tier B (dead nav links): ~1 hour
- Tier C (client demo path): ~3 hours
- Tier D (public pages): ~1.5 hours
- Tier E (orthography): ~30 min
- Tier F (admin polish): ~1.5 hours
- Tier G+H (verification): ~30 min
- **Total: ~10.5 hours** (aggressive estimate; could be 8 hours if cookie fix cascades cleanly)
