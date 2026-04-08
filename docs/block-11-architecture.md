# Block 11 — Multi-Portal Architecture Design Doc

**Date:** 2026-04-08
**Author:** Renato IV + Claude
**Status:** Design — not yet implemented
**Depends on:** Block 8 (pedimento handler), Block 9-10 TBD

---

## 1. Three Portal Types

### Admin Portal (`role: 'admin'`)
**Who:** Renato III (Tito), Renato IV
**Purpose:** Full fleet visibility, system health, all clients, all data

**Shows:**
- `/admin` page with workflow health, classifications, sync coverage
- All client data across EVCO, MAFESA, and future clients
- System metrics: cron health, API costs, agent decisions
- Pipeline status, shadow classifications, workflow events
- Operator activity log (who did what, when)
- Revenue, billing, onboarding tools
- Full nav: 38+ sidebar items across Operaciones, Inteligencia, Cumplimiento, Ventas

**Does NOT show:** Client-facing command center (sees AdminView instead)

---

### Operator Portal (`role: 'operator'`)
**Who:** Eloisa (EVCO trafico clerk), future per-client operators
**Purpose:** Process shipments, manage documents, execute the daily workflow

**Shows:**
- Operator Command Center — same 12-card grid but with OPERATOR data:
  - Entradas: "12 sin asignar — accion requerida" (red, actionable)
  - Docs Pendientes: "3 traficos sin pedimento — completar" (amber)
  - Command strip: "14 pendientes criticos — Resolver ahora"
  - Daily completion loop with actual task progress
  - CRUZ AI agent card with operator-specific suggestions
- Entradas assignment workflow
- Expediente document management
- Draft review + Telegram approval flow
- Pedimento filing (Block 8)
- Client-scoped: Eloisa sees ONLY EVCO data (filtered by her assigned `company_id`)

**Does NOT show:** Other clients' data, system health, admin tools, revenue

---

### Client Portal (`role: 'client'`)
**Who:** Ursula Banda (EVCO shipping manager), future client contacts
**Purpose:** Certainty in 3 seconds. Sleep at night. Zero anxiety.

**Shows:**
- Client Command Center — same 12-card grid but with CLIENT-FRIENDLY data:
  - Entradas: "12 recibidas esta semana" (green, informational — NOT "sin asignar")
  - Traficos: "1 en ruta — todo en orden" (calm, not alarming)
  - Expedientes: "711 expedientes completos" (accomplishment)
  - Pedimentos: "150 este mes — operaciones activas" (confidence)
  - Contabilidad: "$14.3M facturado este mes" (transparency)
  - Puente WTB: live bridge times (useful for their drivers)
  - Tipo de Cambio: live rate (useful for their accounting)
  - CRUZ AI: "Pregunta lo que necesites" (support, not task execution)
  - Command strip: "Todo en orden — sin novedades" (green, always calm unless true emergency)
  - No daily completion loop (that's operator workflow)
  - No docs pendientes card (that's internal broker state)
- Read-only shipment tracking
- Document viewer (not uploader)
- Financial summaries
- Reports

**Does NOT show:** Unassigned entradas, docs pendientes, operator task queue, compliance scores, internal workflow state, anything that creates anxiety about things the client can't control

---

## 2. Role Detection Mechanism

### Current State
```
Cookie: user_role = 'admin' | 'broker' | 'client'
Set by: /api/auth/route.ts on login
Read by: DashboardShellClient.tsx → portalType = 'operator' | 'client'
```

**Problem:** No 'operator' role exists. 'broker' maps to operator but there's no per-client operator concept (Eloisa).

### Proposed Auth Flow

```
Login credentials → /api/auth/route.ts
  ├── ADMIN_PASSWORD → role: 'admin', company_id: null (sees all)
  ├── OPERATOR credentials → role: 'operator', company_id: 'evco'
  │     (from operators table: email + password hash)
  └── CLIENT credentials → role: 'client', company_id: 'evco'
        (from companies table: demo password)
```

**New table: `operators`**
```sql
CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  company_ids TEXT[] NOT NULL,        -- ['evco'] or ['evco', 'mafesa']
  active_company_id TEXT NOT NULL,    -- currently viewing
  role TEXT NOT NULL DEFAULT 'operator',
  permissions JSONB DEFAULT '{}',     -- future: granular permissions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
-- RLS: operators can only read their own row
```

**Login page:** Single login form. Backend determines role from credentials:
1. Check `operators` table first (email + password)
2. Check `companies` table (demo password match)
3. Check env vars (admin/broker passwords)

**Session cookie updates:**
```
user_role: 'admin' | 'operator' | 'client'
company_id: 'evco' | 'mafesa' | etc.
operator_id: UUID (only for operators)
operator_name: 'Eloisa' (only for operators)
```

**DashboardShellClient update:**
```typescript
if (role === 'admin') setPortalType('admin')
else if (role === 'operator') setPortalType('operator')
else setPortalType('client')
```

---

## 3. Operator Action Logging Schema

Every operator action is logged for audit trail, performance tracking, and future automation.

```sql
CREATE TABLE operator_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who
  actor_user_id UUID NOT NULL,              -- operator.id
  actor_name TEXT NOT NULL,                 -- 'Eloisa Garza'
  actor_role TEXT NOT NULL,                 -- 'operator'
  -- What
  action_type TEXT NOT NULL,                -- 'assign_entrada' | 'request_document' | 'approve_draft' | 'file_pedimento' | 'classify_product' | 'update_trafico' | 'send_email' | 'resolve_alert'
  -- Where
  target_table TEXT,                        -- 'entradas' | 'traficos' | 'expediente_documentos' | 'drafts'
  target_id TEXT,                           -- row ID in target table
  company_id TEXT NOT NULL,                 -- 'evco'
  -- Context
  payload JSONB DEFAULT '{}',              -- action-specific data: { entrada_id, trafico_assigned, reason, ... }
  source TEXT DEFAULT 'portal',            -- 'portal' | 'telegram' | 'api' | 'automation'
  duration_ms INT,                         -- how long the action took (for performance tracking)
  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_operator_actions_actor ON operator_actions(actor_user_id, created_at DESC);
CREATE INDEX idx_operator_actions_company ON operator_actions(company_id, created_at DESC);
CREATE INDEX idx_operator_actions_type ON operator_actions(action_type, created_at DESC);

-- RLS: operators see only their own actions + their company's actions
ALTER TABLE operator_actions ENABLE ROW LEVEL SECURITY;
```

**Action types (initial set):**

| action_type | Description | payload example |
|-------------|-------------|-----------------|
| `assign_entrada` | Link entrada to trafico | `{ entrada_id, trafico, prev_trafico }` |
| `request_document` | Send document request to supplier | `{ solicitud_id, supplier, doc_type }` |
| `approve_draft` | Approve a pedimento draft | `{ draft_id, pedimento }` |
| `reject_draft` | Reject with corrections | `{ draft_id, reason }` |
| `file_pedimento` | Submit pedimento to SAT | `{ pedimento, valor_aduana }` |
| `classify_product` | Assign fraccion arancelaria | `{ producto_id, fraccion, method }` |
| `update_trafico` | Change trafico status | `{ trafico, prev_status, new_status }` |
| `send_email` | Send client/supplier email | `{ to, subject, template }` |
| `resolve_alert` | Dismiss or resolve alert | `{ alert_id, resolution }` |
| `login` | Operator session start | `{ ip, device }` |

**Value:** This table becomes the foundation for:
- Operator performance dashboards (actions/hour, avg duration)
- Audit trail for compliance (who filed what pedimento)
- Automation training data (what does Eloisa do after X? → automate it)
- Daily completion loop accuracy (real completions, not estimates)

---

## 4. Block 11 Sub-Block Breakdown

### Block 11A — Auth Layer Split
**Goal:** Three login paths, three session types, three portal renderings

- Add `operators` table + migration + RLS
- Update `/api/auth/route.ts` to check operators table
- Update `DashboardShellClient.tsx` for three portal types
- Update `CruzLayout` to pass correct portalType
- Login page: same form, backend routes to correct portal
- **Test:** Login as Eloisa → sees operator command center. Login as Ursula → sees client command center. Login as Tito → sees admin.

### Block 11B — Client Command Center (Calm View)
**Goal:** Ursula sees confidence, not anxiety

- Fork card subtitles by portalType in `WorkflowGrid.tsx`
- Client view: no command strip critical count, no daily completion loop
- Client view: entradas show "recibidas" not "sin asignar"
- Client view: no docs pendientes card (replace with something positive)
- Client view: CRUZ AI is "ask questions" not "execute tasks"
- **Test:** Login as client → zero red, zero "accion requerida", zero internal state

### Block 11C — Operator Command Center (Action View)
**Goal:** Eloisa's daily workflow in one screen

- Operator sees the current 12-card grid with full operational data
- Command strip with real critical count
- Daily completion loop tracks operator_actions (not estimates)
- CRUZ AI shows operator-specific suggestions
- Add: recent activity feed showing her last 5 actions
- **Test:** Login as Eloisa → sees her assigned client's operational data with actionable cards

### Block 11D — Operator Action Logging
**Goal:** Every click logged, every action traceable

- Create `operator_actions` table + migration
- Add `logOperatorAction()` utility in `lib/`
- Wire into: entrada assignment, draft approval, document request, trafico update
- Update daily completion loop to use real action counts
- **Test:** Eloisa assigns an entrada → row appears in operator_actions

### Block 11E — Login Page Redesign
**Goal:** Login matches the dark command center aesthetic

- Dark background with radial gradient (match mood-calm)
- Geometric crosshair logo centered
- "CRUZ" wordmark
- Single email/password form with gold CTA
- "Patente 3596 · Aduana 240 · Est. 1941" footer
- Mobile: full-screen, 60px inputs, auto-focus
- **Test:** Visual parity with command center dark theme

---

## 5. The "Eloisa Wants to Use It" North Star

Eloisa currently processes EVCO shipments using GlobalPC (legacy desktop software), email, WhatsApp, and phone calls. She switches between 4-5 windows constantly. CRUZ replaces all of them when:

### What makes Eloisa choose CRUZ over legacy:

1. **One screen shows everything.** Open CRUZ, see 12 cards, know exactly what needs doing. No switching windows. No checking email separately. No opening GlobalPC to look up a pedimento number.

2. **One tap does the thing.** "Asignar ahora" assigns the entrada. "Enviar recordatorio" sends the supplier email. "Aprobar borrador" files the pedimento. Each card action is a complete workflow, not a navigation step.

3. **It remembers what she did.** The daily completion loop shows her progress. The operator_actions log means she never has to wonder "did I already send that?" — CRUZ knows.

4. **It tells her what's next.** The CRUZ AI agent card doesn't wait for her to think. It says "3 entradas need assigning, 1 draft needs review, supplier X hasn't responded in 2 days." The system drives the workflow, not the other way around.

5. **It makes her faster, not busier.** Every week, CRUZ learns from her patterns via operator_actions. Actions she does 5x/day become one-tap automations. Actions she always does in sequence become single workflows. The system compounds — it gets smarter because she uses it.

6. **It protects her.** Every action is logged. If SAT audits a pedimento, the trail is there: who filed it, what documents were attached, what value was declared, at what time. Eloisa is covered because CRUZ logged everything she did.

### The test:
> Eloisa opens CRUZ at 7 AM. By 7:05 she's assigned 3 entradas, approved 1 draft, and sent 2 document requests. She hasn't opened GlobalPC, Gmail, or WhatsApp. She closes her laptop at 3 PM having processed 15 operations. CRUZ's daily loop shows 100%.
>
> The next morning, she opens CRUZ and it says: "Ayer: 15 operaciones completadas. Hoy: 4 pendientes."
>
> She never goes back to the old way.

---

*Block 11 is the portal split that makes CRUZ a real multi-user platform.*
*Block 8 (pedimento handler) ships first. Block 11 builds on that foundation.*
