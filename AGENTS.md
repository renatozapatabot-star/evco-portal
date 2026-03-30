# CRUZ Agents
## Renato Zapata & Company · Patente 3596 · Aduana 240 · Laredo TX

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/`
before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## WHEN TO USE AGENTS

Before complex work, choose the appropriate agent from the three below.
Agents reduce hallucinations, catch domain-specific errors, and enforce
the standards Patente 3596 depends on.

- **aduanero** → Before any customs domain logic, financial calculations, or regulatory output
- **architect** → Before any schema changes, new tables, new API routes, or refactors
- **reviewer** → Before every commit — final gate before code reaches production

---

## AGENT: aduanero

**Purpose:** Validates customs domain correctness. Catches errors that general
code review will not catch. Must run before any customs-facing feature ships.

**Trigger keywords:** pedimento, fracción arancelaria, IVA, DTA, IGI, valor_aduana,
MVE, VUCEM, T-MEC, IMMEX, semáforo, clave_cliente, aduana, patente, COVE, entrada

**Protocol:**
```
ADUANERO VALIDATION REQUESTED
============================
Claim: [what the code claims to do]
Domain: [pedimento / fracción / IVA / semáforo / MVE / other]

RULES VERIFIED:
□ Pedimento format: DD AD PPPP SSSSSSS with spaces preserved
□ Fracción format: XXXX.XX.XX with dots preserved
□ IVA base: valor_aduana + DTA + IGI (never invoice × 0.16)
□ Timezone: America/Chicago on all compliance deadlines
□ Currency: explicit MXN or USD on every monetary field
□ Semáforo: step 8 only, separate from bridge/lane (step 9)
□ Client isolation: clave_cliente filter on every query
□ Aduana 240 = Nuevo Laredo (no cross-aduana confusion)
□ Rates from system_config (never hardcoded)

VERDICT: ACCURATE / NEEDS CORRECTION / BLOCKED

If NEEDS CORRECTION or BLOCKED: cite specific rule + exact fix required.
```

**Never approve code that:**
- Calculates IVA as `amount × 0.16` flat
- Strips spaces from pedimento numbers
- Strips dots from fracciones arancelarias
- Uses `new Date()` without `timeZone: 'America/Chicago'` on compliance deadlines
- Contains literal `'9254'` or `'EVCO'` in production queries
- Shows "Verde" text on an unfilled semáforo timeline circle

---

## AGENT: architect

**Purpose:** Reviews system design before code is written. Prevents schema mistakes,
broken RLS, and multi-tenant leaks that are expensive to fix after deployment.

**Trigger keywords:** new table, new route, schema change, new API, refactor,
migration, foreign key, index, RLS policy, JOIN, relationship

**Protocol:**
```
ARCHITECT REVIEW REQUESTED
===========================
Change: [what is being added or modified]
Type: [table / route / refactor / migration / relationship]

BLAST RADIUS ANALYSIS:
□ What tables does this change?
□ What routes consume this data?
□ What RLS policies are affected?
□ What will break if this fails at 3 AM?

SCHEMA REVIEW:
□ RLS enabled on every new/modified table
□ clave_cliente column present for client-facing tables
□ No cross-client data possible via JOIN
□ Service role key never in NEXT_PUBLIC_ vars
□ Parameterized queries only — no SQL concatenation
□ Types generated after migration

MULTI-TENANT SAFETY:
□ Does this work for MAFESA today? (not just EVCO)
□ Is clave_cliente a variable, never a literal?
□ Would a second client see another client's data?

DEPENDENCY FLOW:
□ Business logic in lib/ — not in route handlers or components
□ Route handlers are thin — they call lib/ only
□ app/api/ → lib/ → types/ — direction preserved

VERDICT: APPROVED / REVISION REQUIRED / BLOCKED
```

**Flag immediately if:**
- Table has no RLS
- Query has `'9254'` or `'evco'` as a literal
- JOIN can return another client's data
- Business logic is in a route handler or component
- New feature doesn't work with a second client_code

---

## AGENT: reviewer

**Purpose:** Final gate before commit. Catches everything else. No code ships
without a reviewer pass. Zero tolerance for the items below.

**Trigger:** Before every `git commit` and before every `git push`.
Run `/review` in Claude Code to invoke.

**Protocol:**
```
REVIEWER PASS REQUESTED
========================
Files changed: [list]
Type: [feat / fix / refactor / style / chore]

AUTOMATED CHECKS (must all pass):
□ npm run typecheck — 0 errors
□ npm run lint — 0 errors
□ npm run build — succeeds

GREP GATES (0 matches required for each):
□ grep -r "CRUD" src/
□ grep -r "'9254'" src/ | grep -v test
□ grep -rn "toLocaleDateString" src/app/ | grep -v "es-MX"
□ grep -rn "hace\|timeAgo\|fromNow" src/app/
□ grep -rn "50 clientes\|754 tráficos\|Ollama\|GlobalPC MySQL" src/app/
□ grep -rn "SCORE GENERAL\|Exposición total\|penalidad" src/app/
□ grep -rn "\* 0\.16\b" src/ | grep -v rates
□ grep -rn "#C9A84C\|#c9a84c" src/

DESIGN SYSTEM CHECK:
□ No inline badge styles — <StatusBadge /> only
□ No new hardcoded colors outside CSS tokens
□ JetBrains Mono on all new financial/timestamp display
□ Empty states use <EmptyState /> — never blank white space
□ No dark background outside /cruz and login pages
□ 0 in any KPI card uses --status-gray, never green

MOBILE CHECK:
□ 375px tested for any UI changes
□ Touch targets ≥ 60px on all interactive elements
□ No horizontal overflow introduced
□ New tables have mobile card layout

SECURITY CHECK:
□ No secrets in code
□ All new tables have RLS migration
□ AI output sanitized before render
□ No PII in logs

COMPLETION CRITERIA:
□ Spanish primary on all new user-facing text
□ fmtDate() / fmtDateTime() on all new date displays
□ lib/ for business logic — not components or routes

VERDICT: APPROVED / REVISION REQUIRED
```

**Hard blocks — these prevent approval regardless of anything else:**
- Any `* 0.16` IVA calculation outside `lib/rates.ts`
- Any `'9254'` or `'EVCO'` literal in production queries
- Any English date format (`toLocaleDateString` without `'es-MX'`)
- Any relative time string in the UI
- Any new table without RLS
- Any compliance score, penalty amount, or MVE detail in client-facing views
- "CRUD" anywhere in the codebase

---

## USAGE EXAMPLES

### Before writing a financial calculation:
```
Run aduanero agent.
Claim: Calculate total pedimento duties including DTA, IGI, and IVA.
Domain: IVA / DTA / IGI
```

### Before adding a new Supabase table:
```
Run architect agent.
Change: New table documento_solicitudes to track document requests.
Type: table + migration
```

### Before committing V6 Phase 1 fixes:
```
Run reviewer agent.
Files changed: [list from git diff --stat]
Type: fix (design-system, compliance, dates)
```

---

*CRUZ Agents — defense in depth for a border that doesn't forgive mistakes*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*