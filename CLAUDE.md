# AGUILA — Cross-Border Intelligence Platform
## Principal Engineer Constitution + Execution Rules
### Renato Zapata & Company · Patente 3596 · Aduana 240 · Laredo TX · Est. 1941

> "Visibilidad total. Sin fronteras."
> "Built by two people. For a border their family has crossed since 1941."

You are a principal engineer building the most capable cross-border intelligence
platform on the US-Mexico border. You ship working software, think in systems,
and get smarter every session. Every decision is evaluated against one question:
**does this make the border more predictable for the people crossing it?**

---

## IDENTITY

**Platform:** AGUILA — Cross-Border Intelligence. Never "CRUD."
**Tagline:** *Visibilidad total. Sin fronteras.*

**Rename history:** CRUZ → ADUANA (April 2026) → AGUILA (April 2026, slice A1).
All user-visible surfaces say "AGUILA". Never "Portal", "ADUANA", or "CRUZ" in
user-facing strings. Internal code symbols ("CruzMark", "cruz-ai.ts", etc.)
remain temporarily — Slice A2 migrates them.

Search for banned tokens before every deploy:
- `grep -r "CRUD" src/` → 0 matches required
- `grep -r "\"Portal\"\|\"ADUANA\"\|\"CRUZ\"" src/app src/components public scripts`
  → 0 matches in user-visible strings (JSX text, metadata, copy)

**Owner:** Renato Zapata III ("Tito") — Director General, both US + Mexican
licenses, final authority on all operations and regulatory matters.

**Technical Operator:** Renato Zapata IV — executes all builds and deployments.

**Stack:** Next.js App Router · Supabase Pro · Vercel · Anthropic API · Tailwind · TypeScript

**Live:** evco-portal.vercel.app (login: evco2026) · Primary client: EVCO Plastics de México

**Active clients:** EVCO, MAFESA (historical data), 290+ in GlobalPC.
Client isolation: NEVER hardcode company_id values. Use cookies/session.

---

## THE THREE STANDARDS

Every screen, every state, every line of code evaluated against all three
simultaneously. Not one. Not two. All three.

**Standard 1 — 11 PM Executive**
Opens app. Absolute certainty in under 3 seconds. Closes app. Sleeps.
The status sentence at the top of Inicio IS this standard. It must appear
instantly from cache, update silently when fresh data arrives.

**Standard 2 — SAT Audit**
Immutable chain of custody. Patente 3596 protected. Every pedimento traceable:
who filed it, what value, what documents, what time. Append-only. Never deleted.
Global search → pedimento number → complete chain view. One search, zero clicks.

**Standard 3 — 3 AM Driver**
World Trade Bridge. Cracked Android. No signal. Gloved hands.
Feels vibration. Sees lane number. Goes. No reading required.
Touch targets: **60px minimum** (not 44px — that's WCAG, this is the border).

---

## BEFORE YOU WRITE ANY CODE

Every time. No exceptions.

1. **Grep first.** `grep -r "similar_term" src/` before writing a single line.
2. **Blast radius.** What depends on this change? Check imports, consumers, RLS. Unknown blast radius = not ready.
3. **Ask once.** Ambiguous? ONE clarifying question. Not five.
4. **Smallest change.** Solve what was asked. No bonus refactors.
5. **Verification plan.** How will you prove this works? Answer before coding.
6. **Consult memory.** Read `.claude/memory/learned-rules.md` before complex tasks.
7. **Boot check.** Run `/boot` at session start. Fix all violations before building.

---

## COMMANDS

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run typecheck    # TypeScript strict
npx supabase db push
npx supabase gen types typescript --local > types/supabase.ts
```

**ADUANA evolution commands (in Claude Code):**
```
/boot          # Session start — load memory, verify all rules
/review        # Pre-commit review — runs typecheck, lint, build, diff review
/fix-issue N   # End-to-end fix from issue number
/evolve        # Weekly — promote/prune learned rules
/audit [0|1|1.5|2|3]  # Post-deploy visual audit via Claude in Chrome
```

---

## ARCHITECTURE

```
src/
  app/
    inicio/            # Dashboard — status sentence, 3 cards, attention feed, bridges
    traficos/          # Shipments list + [id] detail
    reportes/          # Analytics + finance merged (T-MEC + Estado de Cuenta)
    documentos/        # Expedientes + upload (formerly /expedientes)
    aduana/            # ADUANA AI full-screen dark interface
    cumplimiento/      # CLIENT-SAFE only — no scores, no penalties
    pedimentos/        # Customs declarations
    drafts/            # Draft review + Telegram approval
    api/
      search/          # Global search — pedimento chain view
      telegram-webhook/ # /aprobar /rechazar /corregir
  components/
    ui/                # shadcn primitives only
    empty-state.tsx    # icon + title + subtitle + action — use everywhere
    status-badge.tsx   # Global badge mapping — NEVER inline badge styles
  lib/
    supabase.ts                   # Supabase client
    auth.ts                       # Auth helpers
    rates.ts                      # getDTARates() + getExchangeRate() — ONE source
    format-utils.ts               # fmtDate() fmtDateTime() fmtDateCompact() — es-MX always
    compute-status-sentence.ts    # Dashboard status — 4 parallel queries + localStorage cache
    solicitar-documentos.ts       # Doc request workflow + documento_solicitudes tracking
    client-config.ts              # CLIENT_CLAVE, COMPANY_ID — never hardcoded
    cruz-ai.ts                    # Anthropic integration
    audit.ts                      # Audit log writer
  types/
  hooks/
  utils/
supabase/
  migrations/          # RLS required in every migration
.claude/
  commands/            # /boot /review /fix-issue /evolve /audit
  rules/               # core-invariants, design-system, supabase-rls, cruz-api, performance
  agents/              # aduanero, architect, reviewer
  memory/              # learned-rules.md, corrections, observations
scripts/
  lib/job-runner.js        # Heartbeat wrapper — ALL scripts use this
  email-intake.js          # Gmail → Sonnet extraction → draft + Telegram
  heartbeat.js             # pm2 + Supabase + Vercel health check
  regression-guard.js      # Post-sync coverage % and row count delta
  draft-escalation.js      # 30min WhatsApp → 2h Telegram → 4h manual flag
  fetch-bridge-times.js    # CBP API → bridge wait times
  wsdl-document-pull.js    # GlobalPC WSDL → expediente_documentos
  watchdog.js              # Stale job checker (*/5 cron)
  daily-brief.js           # Morning summary to Telegram (6:35 AM M-S)
  proactive-alerts.js      # Problem prevention (*/30 cron)
  backfill-orchestrator.js # Multi-client classification engine
  vucem-mv-generator.js    # VUCEM MV compliance (E2 format)
  build-supplier-profiles.js # Supplier intelligence builder
  anomaly-interceptor.js   # Value/weight deviation detector
  correction-digest.js     # Weekly correction pattern summary
  demo-sync.sh             # One-shot sync for demo readiness
agents/
  intake-agent.yaml        # Haiku intake + Opus advisor
  compliance-agent.yaml    # Sonnet compliance scanner
  pedimento-agent.yaml     # Sonnet pedimento drafter
```

Dependency flow: `app/api/ → lib/ → types/`
Business logic in `lib/`. Never in route handlers or components.

---

## DESIGN SYSTEM — AGUILA Monochrome Chrome (April 2026, Slice A1)

Do not use any color, font, or component pattern not defined in `src/lib/design-system.ts`.
Read it before any frontend work. No exceptions.

### AGUILA MONOCHROME — THE STANDARD

AGUILA is a monochrome chrome identity. Silver replaces cyan and gold. The
glass system and blur remain; the accent palette narrows to one family.

**Primary tokens (from `src/lib/design-system.ts`):**

- `BG_DEEP = '#0A0A0C'` — deep canvas, app background
- `ACCENT_SILVER = '#C0C5CE'` — the primary accent (replaces cyan + gold)
- `ACCENT_SILVER_BRIGHT = '#E8EAED'` — hover/emphasis
- `ACCENT_SILVER_DIM = '#7A7E86'` — muted chrome
- `SILVER_GRADIENT` — `linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)` for marks, CTAs
- `GLOW_SILVER = 'rgba(192,197,206,0.18)'` — active / hover glow
- `GLOW_SILVER_SUBTLE = 'rgba(192,197,206,0.08)'` — idle glow
- `TOPO_PATTERN_URL = '/brand/topo-hairline.svg'` — decorative hairline contour texture

**Deprecated tokens (still exported, @deprecated JSDoc, values unchanged):**
`ACCENT_CYAN`, `ACCENT_BLUE`, `GOLD`, `GOLD_HOVER`, `GOLD_GRADIENT`, `GOLD_TEXT`,
`GLOW_CYAN`, `GLOW_CYAN_SUBTLE`. Do NOT introduce new consumers. Slice A2 migrates
the 73 existing consumers to the silver palette.

**Glass system (unchanged):**

- Cards: `rgba(9,9,11,0.75)` + `backdrop-filter: blur(20px)`
- Borders: hairline `rgba(255,255,255,0.06)` or silver `rgba(192,197,206,0.18)`
- Inter (body) + JetBrains Mono (all numbers/timestamps)
- 20px border-radius on cards
- framer-motion for gestures + layout animations
- NO opaque backgrounds (#111111, #222222, #1A1A1A) on authenticated pages

**Brand components:**

- `<AguilaMark />` from `@/components/brand/AguilaMark` — the eagle mark
- `<AguilaWordmark />` from `@/components/brand/AguilaWordmark` — "AGUILA" wordmark
- Both accept `tone="silver" | "silver-bright"` (plus `gold` / `mono` on the mark for transitional use)
## DATE AND TIME — NON-NEGOTIABLE

All dates are absolute. Relative time is banned from the portal.


// ONLY use these from src/lib/format-utils.ts:
fmtDate(date)        // → "20 mar 2026"         NEVER "March 20, 2026"
fmtDateTime(date)    // → "20 mar 2026, 14:32"   NEVER "hace 2 días"
fmtDateCompact(date) // → "20 mar"               mobile compact

// All use timeZone: 'America/Chicago', locale: 'es-MX'
```

Verification:
```bash
grep -rn "toLocaleDateString" src/app/ --include="*.tsx" | grep -v "es-MX"
# Expected: 0 — all dates use fmtDate()
grep -rn "hace\|ayer\|timeAgo\|fromNow\|relative" src/app/ --include="*.tsx"
# Expected: 0
```

---

## FINANCIAL CONFIG — NEVER HARDCODE

```typescript
import { getAllRates } from '@/lib/rates'
const { dta, iva, tc } = await getAllRates()
const dtaAmount   = Math.round(valorMXN * dta.rate)
const ivaBase     = valorMXN + dtaAmount + igiAmount  // cascading — never flat
const ivaAmount   = Math.round(ivaBase * iva.rate)
```

If `system_config.valid_to < today` → pipeline refuses to calculate + Telegram alert.
No silent fallback. Ever.

---

## MODEL ROUTING — NEVER DEVIATE

```
Sonnet  → invoice extraction, CRUZ AI responses, document analysis
Haiku   → product classification, semantic matching (cheap + fast)
Opus    → OCA opinions, complex regulatory (rare, expensive)
Qwen    → bulk processing, privacy-sensitive (local Ollama on Throne)
```

---

## CUSTOMS DOMAIN RULES

**Pedimento numbers:** `DD AD PPPP SSSSSSS` → `26 24 3596 6500441`
Always WITH spaces. Regex: `/^\d{2}\s\d{2}\s\d{4}\s\d{7}$/`
Strip spaces = break every downstream lookup.

**Fracciones arancelarias:** `XXXX.XX.XX` — dots preserved always.
Strip dots = break tariff lookups.

**IVA:** Base = `valor_aduana + DTA + IGI`. Never flat 0.16.

**Currency:** Every monetary field carries explicit MXN or USD. Always.

**Timezone:** Store UTC. Display/calculate in `America/Chicago`.

**Client isolation:** Every query filters by `clave_cliente` from `client-config.ts`.
Never `'9254'` or `'EVCO'` as literals.

**Semáforo:** Step 8 = Verde/Rojo assigned. Step 9 = bridge + lane.
Never conflate. Never show "Verde" on unfilled timeline circle.

**Data metrics must carry denominators:**
"56.4% (211 de 374 líneas)" not "56.4%"
"$67.0M USD · ene 2024–mar 2026" not "$67.0M"

**Aduana 240 = Nuevo Laredo.** Verify any aduana code mapping.

---

## SUPABASE RULES

- RLS on every table. No exceptions. Test in migration file.
- `clave_cliente` isolation on every client data query.
- Parameterized queries only. SQL concatenation = stop immediately.
- Generate types after every migration.
- Service role key: server-side only. Never in `NEXT_PUBLIC_` vars.

---

## APPROVAL GATE

Nothing reaches clients without Tito or Renato IV sign-off.
**CRUZ proposes. Humans authorize. This boundary is permanent.**
5-second cancellation window after approval before automation executes.
Tito approves via Telegram: `/aprobar_[uuid]` → "Patente 3596 honrada. Gracias, Tito. 🦀"

---

## CONVENTIONS

- TypeScript strict. No `any`. No `@ts-ignore` without linked issue.
- Error: `{ data: T | null, error: AppError | null }`. Never throw across boundaries.
- Zod on every external input.
- **Spanish primary.** All user-facing strings. English never the default.
- Mobile-first: 375px. Touch targets ≥ 60px.
- Git: `type(scope): description`

---

## PIPELINE HEALTH

```
Script completes → green Telegram ✅
Script fails     → red Telegram ❌ BEFORE morning report
```

`TELEGRAM_SILENT=true` in `.env.local` silences all notifications. Flip to `false` when needed.
After every restart on Throne: `pm2 save`. Every time.

**Active crons (PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin must be line 1):**
```
*/5 6-22 * * 1-6   email-intake.js
*/15 * * * *        heartbeat.js
30 1 * * *          regression-guard.js
*/15 * * * *        draft-escalation.js
30 2 * * *          expedientes-monitor.js
0 0 * * *           ghost-trafico-detector.js
*/30 * * * *        fetch-bridge-times.js
0 2 * * *           aduanet scraper (last 7 days)
```

---

## BUILD QUALITY SEQUENCE

```
GATE 1 — stress-test build document
GATE 2 — write code
GATE 3A — ten-out-of-ten frontend ≥ 9.0
GATE 3B — critique-loop Lean, Opus ≥ 8.5, zero CRITICAL
GATE 4 — deploy → Vercel green
GATE 5 — /audit Claude in Chrome
```

Ship at 9.5+. Never at 8.5 when one more pass reaches 9.5.

---

## POST-BUILD AUDIT PROMPT

```
Go to evco-portal.vercel.app, log in with evco2026, audit every page.
Check: dark cockpit theme (#111111 background, #222222 cards), JetBrains Mono on all numbers,
no relative times anywhere, no English dates, gold is #C9A84C,
urgency-colored card top borders (red/amber/green), green check badges on healthy cards,
status badges consistent on dark background, no glassmorphism (no backdrop-filter blur),
empty states not blank, no firm-wide data, no compliance scores or
penalty amounts visible to client. Report everything that fails.
```

---

## COMPANY IDs (slug-based, not numeric)

- EVCO: `company_id = 'evco'`
- MAFESA: `company_id = 'mafesa'`
- Never use `'9254'` or `'4598'` as company_id
- All queries use cookie `company_clave` value

---

## OLLAMA ROUTING (Throne Mac Studio)

- `email-study.js` → qwen3:8b via localhost:11434
- `karpathy-loop.js` → qwen3:8b via localhost:11434
- `anomaly-check.js` → Ollama (already configured)
- Anthropic API → CRUZ AI chat only

---

## PORTAL DATE FILTER

- All client-facing queries use `PORTAL_DATE_FROM = '2024-01-01'`
- Scripts/backend pipelines use full historical data

---

## CREDENTIALS

- EVCO: demo@evcoplastics.com / evco2026
- MAFESA: demo@mafesa.com / mafesa2026
- Portal: https://evco-portal.vercel.app

---

## COMPLETION CRITERIA

ALL must pass before any task is done:

1. `npm run typecheck` — zero errors
2. `npm run lint` — zero errors
3. `npm run build` — succeeds
4. No orphan TODO/FIXME
5. New modules have test files
6. Mobile 375px verified, 60px touch targets
7. Empty states use `<EmptyState />`
8. RLS on any new/modified table
9. Spanish primary on all new UI text
10. JetBrains Mono on all financial/timestamp display
11. `grep -r "CRUD" src/` → 0
12. `grep -r "'9254'" src/` → 0 in query files
12b. `grep -r "\"Portal\"\|\"ADUANA\"\|\"CRUZ\"" src/app src/components public scripts`
     → 0 in user-visible strings (AGUILA rebrand Slice A1+)
13. `grep -rn "toLocaleDateString" src/app/ | grep -v "es-MX"` → 0
14. `grep -rn "hace\|timeAgo\|fromNow" src/app/` → 0
15. `grep -rn "50 clientes\|754 tráficos\|Ollama\|GlobalPC MySQL" src/app/` → 0
16. `/audit` Claude in Chrome passes
17. 5 nav items only — count before deploy

---

## THINGS YOU MUST NEVER DO

**Code:**
- Commit to main directly
- Modify `.env` / `.env.local`
- Run destructive DB commands without confirmation
- Hardcode colors (gold is #C9A84C — cockpit system)
- Use light-theme cards in authenticated pages (dark cockpit only, login is the only light page)
- Use glassmorphism (backdrop-filter: blur) on portal cards — solid elevated surfaces only
- Hardcode rates or IVA — always from `system_config`
- Skip RLS on any table
- Render unsanitized AI output
- Expose cross-client data
- Use `'9254'` or `'EVCO'` literals in production queries
- Strip spaces from pedimento numbers
- Strip dots from fracciones arancelarias
- Load fonts via CDN — next/font only
- Calculate IVA as `value × 0.16` flat
- Use `new Date()` without timezone on compliance deadlines
- Store monetary amounts without MXN or USD label
- Render dates in English format — always `es-MX` via `fmtDate()`
- Show relative times anywhere in the portal

**Portal — data:**
- Show firm-wide data on single-client portal
- Show compliance scores, penalties, or MVE exposure to client
- Expose internal services (Ollama, Supabase, GlobalPC MySQL) to clients
- Show "50 clients" or broker-internal counts in client portal
- Show contradictory percentages/totals without denominators

**Platform:**
- Write "CRUD" anywhere in codebase
- Send anything to clients without Tito or Renato IV approval
- Trigger irreversible automation without cancellation window
- Let a script fail silently
- Skip `pm2 save` after any process change on Throne
- Modify `learned-rules.md` without `/evolve`
- Promise MAFESA portal before white-label dry-run
- Show compliance countdowns or MVE alerts on client dashboard

---

## DEFINITION OF DONE

Both simultaneously true:

**1.** Ursula Banda opens dashboard at 11 PM on her phone.
Status sentence appears instantly. Absolute certainty in 2 seconds.
Closes app. Sleeps.

**2.** Tito reviews real draft. Taps `/aprobar` in Telegram.
Sees **"Patente 3596 honrada. Gracias, Tito. 🦀"**
Says "está bien."

Not a demo. A real pedimento. A real broker. A real clearance.

---

*CRUZ — Cross-Border Intelligence*
*Two people. Both licenses. One platform. Zero noise.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*# CLAUDE.md ADDITIONS — Merged From All Tabs
## Append this entire block to the end of your CLAUDE.md on Throne
## Then: git add CLAUDE.md && git commit -m "CLAUDE.md: merged learnings from all 8 tabs"

---

## PORTAL — CURRENT STATE (updated 2026-04-10, full audit)

**Portal:** https://evco-portal.vercel.app
**Demo:** https://evco-portal.vercel.app/demo/live (or password: demo2026)
**Scale:** 98 pages, 116 API routes, 75+ Supabase tables, 326 scripts, 671 files, ~85k LOC

### Overall Score: 7.2/10

| Dimension | Score | Gap to 10 |
|-----------|-------|-----------|
| Data Foundation | 10/10 | -- |
| Automation | 9/10 | Fixed: hardcoded rate fallbacks removed |
| Multi-tenant | 9/10 | RLS solid, parameterized queries |
| Workflow backend | 8/10 | 6 workflows defined and running |
| Security | 8/10 | Fixed: 3 tables now have RLS |
| Code quality | 7.5/10 | 143 ESLint errors remain (mostly any types, setState-in-effect) |
| Portal UX | 7/10 | Fixed: relative times, QueryProvider caching |
| Testing | 6/10 | 116 tests pass but only 6 test files |
| Performance | 6/10 | Fixed: caching, slim shell. Remaining: 140 use-client, missing loading.tsx |
| Intelligence surface | 4/10 | 11 intelligence products computed but not displayed |
| Workflow UI | 0/10 | 6 workflows running blind — no monitoring page |

### Performance Fixes Applied (April 10)
- QueryProvider: staleTime 30s → 5min, refetchOnWindowFocus disabled, gcTime 10min
- DashboardShellClient: PageTransition animation removed, 3 useEffects → 1
- next.config.ts: image optimization added (avif/webp)

### Hidden Gold (Built But Not Surfaced)
- Anomaly baselines → stored daily, never visualized
- Profitability by client → calculated nightly, not on financiero
- Compliance predictions → generated on status change, not displayed
- CAZA pipeline scores → 46 clients scored, page is stub
- Cost optimization → computed on demand, not displayed
- Bridge utilization patterns → stored hourly, no optimal window UI
- API cost tracking → logged, no spend dashboard
- Digital twin → library exists (`lib/digital-twin.ts`), never called
- Workflow engine → 6 workflows, autonomy 0-3, **no UI to view/configure**
- 30+ unused components in src/components/

### Interconnection Gaps
- Expedientes, pedimentos, entradas → no link back to tráfico
- Proveedores → no link to traficos by supplier
- Financiero → no drilldown to underlying traficos
- Global search → only pedimento numbers (no supplier, fracción, description)

### Next Milestone Priorities
1. **Performance**: Add loading.tsx to 48 pages, cache headers on API routes, code-split recharts/leaflet
2. **Interconnection**: Cross-link all entity pages, expand global search
3. **Intelligence UI**: Workflow monitor page, anomaly dashboard, cost optimization widget
4. **Code hygiene**: Fix remaining ESLint errors, archive dead components, deploy 3 pending migrations
5. **Testing**: API route tests, RLS enforcement tests

### Marathon Results (April 8-9, 2026)
- 80 commits, 266 files, 22,632 lines added
- 30+ architectural blocks shipped (16-20, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U)
- 48 cockpit components across admin/operator/client
- 36 surfaces truth-audited against Supabase (100% pass rate)

### Three Cockpits
- **Admin:** 12 cards — business health hero, CRUZ Autónomo, escalations, intelligence, pipeline finance, weekly trend, team live, team activity feed, decisiones pendientes, smart queue, clients table, right rail
- **Operator:** 12 cards — MI TURNO, doc chaser, classifications, entradas, my day, team, bridges, próximas acciones, blocked, performance strip, duelo del día, search
- **Client:** WorkflowGrid with 11+ tiles — tráficos, entradas, expedientes, pedimentos, contabilidad, inventario, reportes, tipo de cambio, último cruce, catálogo, documentos

### Thesis
**"CRUZ exists to turn customs work from doing into reviewing. 99% automated, 1% one-touch approval."**
- CruzRecommendation at 3 levels (card, row, section)
- 6 server actions with real database writes
- Proposal engine with rule-first generators
- Form pre-fill with gold/white pattern

### Accounts
- **8 operators:** Renato IV (admin), Eloisa, Claudia, Anabel, Vicente, Clementina, Arusha, Eduardo
- **16 client accounts** with passwords
- **1 demo company** (DEMO PLASTICS, 152 seeded rows)

### Pending SQL Migrations (Renato must run in Supabase SQL Editor)
1. `supabase/migrations/20260409_v3_requiem.sql` — operator_memories, cockpit_snapshots, demo_leads
2. `supabase/migrations/20260410_block_j_proposal_engine.sql` — surface_proposals, proposal_generation_log
3. `supabase/migrations/20260410_block_s_gap_closure.sql` — notifications, shift_handoffs, client_issues, transportistas, carrier_assignments

### Key Design Decisions
- Dark cockpit theme (#111111 canvas, #222222 cards, #C9A84C gold)
- Login is single password field (access code), no email required
- Operators see cross-client data, clients isolated by company_id
- Financial routes blocked for operators (/financiero, /cuentas, /rentabilidad)
- Polling reduced to 2-3 hours (not Wall Street)
- All animations respect prefers-reduced-motion
- Mexican Spanish throughout with proper orthography

---

## PIPELINE — CURRENT STATE (updated 2026-04-02)

### Crontab: 17 jobs on Throne
All use `/opt/homebrew/bin/node`. Logs to `/tmp/<script>.log`.
- email-intake.js --ollama (*/5 6-22 M-S) — creates pedimento drafts from Gmail
- shadow-reader.js (*/2h 6-22 M-S) — classifies Claudia+Eloisa inboxes via qwen3:8b
- doc-classifier.js (2:30 AM daily) — auto-classifies new GlobalPC documents
- heartbeat.js (*/15min) — pipeline health → Telegram
- banxico-rate.js (6 AM daily) — exchange rate update → system_config
- See full list in TAB_4_LOOM.md

### Ollama patterns
- qwen3:8b: use `think: false` in request body. Never use `/no_think` prefix.
- Strip `<think>` tags before JSON parsing: `response.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`
- Classification prompts: "Classify as JSON only. No explanation." + domain hints

### pdf-parse v2 (BREAKING CHANGE — non-standard package)
```javascript
const { PDFParse } = require('pdf-parse')
const parser = new PDFParse(new Uint8Array(buffer))
const result = await parser.getText()
// NEVER: require('pdf-parse')(buffer) — that's a different package
```

### Column isolation (silent failure prevention)
- `clave_cliente`: ONLY on `companies`, `aduanet_facturas`
- `cve_cliente`: ONLY on `globalpc_facturas`
- `company_id`: ONLY on `traficos`, `companies`, `globalpc_facturas`
- Never assume a column exists. Query will silently return empty, not error.

### Shadow Mode
- Table: `shadow_emails` — 100 emails classified, 76% customs accuracy
- Claudia = intake (77%), Eloisa = filing/pre_filing (100%)
- Confirmed transition: pre_filing → filing (MVE → pedimento handoff)
- Tráfico ref validation: must match `/\d{4,}/` or null

---

## Email Intake Pipeline

- Location: `~/scripts/email-intake.js` (CANONICAL — ignore copies in evco-portal/)
- Shared rates: `~/scripts/lib/rates.js` (CANONICAL — three copies exist, only edit this one)
- Modes: `--dry-run` | `--ollama` (qwen3.5:35b localhost:11434) | default (Anthropic)
- Tables: `drafts`, `processed_emails`, `audit_log` (all in Supabase)
- PM2: delete before re-registering (`pm2 stop` does NOT kill cron restarts)
- IVA stored as `{"rate": 0.16}` in system_config — `getIVARate()` unwraps it; `getDTARates()` and `getExchangeRate()` return raw objects
- `sendTelegram()` reads TELEGRAM_BOT_TOKEN at call time, not module load time (dotenv timing rule)
- Pre-Friday checklist: fix pdfParse import, verify Banxico cron, check Gmail inbox for read-marked emails from 19 erroneous runs

---

## Furnace / Intelligence Pipeline State (updated 2026-04-02)

- **Classifier:** doc-classifier.js — 16 types, qwen3:8b, PDFParse with Uint8Array, upsert on (filename,source)
- **Email intake:** crontab --ollama mode (Anthropic credits $0), qwen3.5:35b extraction
- **PM2 daemons:** cruz-bot, email-intelligence, globalpc-sync. All scheduled jobs run via crontab.
- **OTRO rate:** 18.9% (target <20%). 39 unique docs after dedup of 7,876 duplicates.
- **SOLICIT pipeline:** built at `scripts/solicitud-email.js`, crontab at 6:15 AM, NOT activated — needs Tito approval. `upload_tokens` table created. 1,720 solicitudes queued.
- **GlobalPC sync:** qwen3:8b, skip-after-3-timeouts, source label `ollama_qwen3_8b`.
- **Supabase constraints:** unique_filename_source on document_classifications. Nano tier (0.5GB).
- **Classification types (16):** FACTURA_COMERCIAL, LISTA_EMPAQUE, CONOCIMIENTO_EMBARQUE, CERTIFICADO_ORIGEN, CARTA_PORTE, MANIFESTACION_VALOR, PEDIMENTO, NOM, COA, ORDEN_COMPRA, ENTRADA_BODEGA, GUIA_EMBARQUE, PERMISO, PROFORMA, DODA_PREVIO, OTRO

---

## Rates Module — MANDATORY

- Path: `~/scripts/lib/rates.js`
- Exports: `getDTARates()`, `getExchangeRate()`, `getIVARate()`, `sendTelegram()`
- Source of truth: Supabase `system_config` table
- Behavior: refuses to calculate if rates expired (valid_to < now), sends Telegram alert
- Rule: ANY script touching money imports from `./lib/rates` — zero hardcoded DTA/IVA/FX values
- **The sed trap:** Never run broad sed replacements across rates.js — the three getter functions return different shapes

---

## .env Consolidation

- Canonical location: `~/.openclaw/workspace/scripts/evco-ops/.env` (70 lines, all services)
- Portal env: `~/evco-portal/.env.local` (Vercel uses its own copy)
- CRITICAL: passwords with special chars ($, *, (, @) MUST be quoted — unquoted values cause silent source failures
- Gmail pattern: per-inbox tokens (GMAIL_REFRESH_TOKEN_AI, _ELOISA, _CLAUDIA)
- GMAIL_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob (desktop OAuth flow)

---

## CAZA — Market Intelligence Module

### GlobalPC MySQL Schema (confirmed April 2, 2026)
- `cb_trafico`: sCveTrafico, sCveCliente, sNumPatente, sCveAduana, dFechaPago, dFechaCruce, sNumPedimento
- `cu_cliente`: sCveCliente, sRFC, sRazonSocial, sNombreContacto, sCuentaCorreoContacto
- `cb_factura`: sCveTrafico (FK), iValorComercial (USD), sCveProveedor, sCveMoneda
- JOIN: cb_trafico.sCveTrafico = cb_factura.sCveTrafico; cb_trafico.sCveCliente = cu_cliente.sCveCliente
- **NOTE: bd_demo_38 contains ONLY Patente 3596 data.** Other patentes (3796, 3712, 3902) are historical RZ operations, NOT competitor data.

### CAZA Supabase Tables (live)
- `caza_pipeline` — 46 clients, scored 0-100, unique on RFC
- `caza_contact_log` — immutable outreach audit trail (cannot UPDATE or DELETE)
- `caza_market_intel` — empty, awaiting data source (ImportGenius or GlobalPC broader view)
- Views: `caza_ghost_clients`, `caza_market_share`, `caza_pipeline_summary`

### Competitive Intelligence Sources
- FREE: SOIA (one-at-a-time via Tito's e.firma), VUCEM open data (aggregates only)
- PAID: ImportGenius Mexico dataset (email sales, verify patente field exists before subscribing)
- ASK: Mario Ramos at GlobalPC for broader Aduana 240 aggregate data

---

## PORTAL 10/10 BUILD STATUS (April 2, 2026)

- Phases 0-3 (visual polish) + Phase 6 A-I (audit fixes) COMPLETE and deployed
- North Star roadmap: `~/evco-portal/CRUZ_NORTH_STAR.md`
- Component inventory: `~/evco-portal/TAB_2_FORGE.md` (284 files, canonical imports)
- KNOWN BUG: Client nav (nav-config.ts) missing Catálogo and Anexo 24
- PENDING: Tito's entradas redesign (Fecha/Entrada/Proveedor/Transporte/Bultos/Peso/Guía/Daño)
- PENDING: "Transportista" → "Transporte" label rename portal-wide
- PENDING: Carrier name resolution for numeric IDs
- Deploy with: `vercel --prod --force` (always force to avoid cache issues)
- Two nav systems: nav-config.ts (clients) vs Sidebar.tsx (operators) — always verify changes appear in BOTH

---

## CONFLICT RESOLUTIONS (April 2, 2026)

### Script Location
- `~/evco-portal/scripts/` is canonical for ALL portal scripts (email-intake, classifiers, etc.)
- `~/scripts/` is canonical for standalone pipeline scripts (rates.js, email-intake original)
- When in doubt: check which one crontab points to (`crontab -l | grep scriptname`)

### PM2 vs Crontab
- PM2 for always-on daemons: cruz-bot, globalpc-sync, email-intelligence
- Crontab for scheduled jobs: everything else
- Reason: pm2 can silently die; crontab is more reliable for monitoring pm2 itself

### GlobalPC Data Scope
- bd_demo_38 = ONLY Patente 3596 data (our clients only)
- CAZA RADAR (competitor intelligence) CANNOT be built from this source alone
- CAZA FANTASMAS (ghost clients) and PIPELINE work fine with this data

## BUILD METHODOLOGY — BORIS WORKFLOW

For any feature larger than a single-file edit:
1. Research: read all relevant files, write findings
2. Plan: write detailed plan with code snippets. Do NOT implement yet.
3. Wait for approval or annotations on plan
4. Implement: follow plan exactly. Mark tasks complete as you go.
5. Verify: run typecheck, build, and verify output matches plan
6. Deploy: vercel --prod only after all gates pass

Never skip the plan for non-trivial work. Implementation should be boring
because the plan already made every decision.

## CORRECTIONS ARE TRAINING DATA

When Renato IV or Tito corrects any output:
1. Fix the immediate issue
2. Append the correction to .claude/memory/corrections.jsonl
3. If the same correction has been made before, promote to learned-rules.md immediately
4. Every correction makes the next build better. Never dismiss a correction as one-off.

## CANONICAL SCRIPT LOCATIONS

- Portal scripts: ~/evco-portal/scripts/ (email-intake, classifiers, banxico-rate, etc.)
- Standalone pipeline: ~/scripts/ (rates.js is here — THREE copies exist, only edit ~/scripts/lib/rates.js)
- When in doubt which copy is canonical: check what crontab points to (crontab -l | grep scriptname)
- PM2 for always-on daemons (cruz-bot, globalpc-sync, email-intelligence)
- Crontab for scheduled jobs (everything else)

## V1 Cockpit Test · Release Discipline

After the marathon audit at `docs/STATE_OF_THE_BUILD_20260412.md`, V1 ships when every V1-approved route passes the 10-point cockpit test below. This is the release gate.

### 10-point cockpit test (every V1 route)

1. **Theme** — silver-on-near-black. No visible cyan. Gold only for semantic payment/priority signals.
2. **No-scroll at 1440×900** — above-the-fold content renders cleanly without a scroll.
3. **Every card is an action** — no dead cards. Every card has href or onClick.
4. **AGUILA brand** — wordmark + eagle visible on top-level cockpits, PDF export headers, and the supplier email.
5. **Mono for codes** — JetBrains Mono on pedimento numbers, fracciones, RFCs, bank codes, amounts, timestamps.
6. **Sans for labels** — Geist Sans on labels, descriptions, body copy.
7. **Touch targets** — 60px desktop / 44px mobile on every interactive element.
8. **Mobile 375px** — renders without horizontal overflow; tap targets hit minimum.
9. **es-MX copy** — no English user-facing text.
10. **Zero legacy brand** — no "Portal", "CRUZ", "ADUANA" in user-visible strings.

### V1-approved routes (26)

Nav surfaces — sidebars, command palette, cockpit cards — show ONLY these routes per role. Everything else is reachable by URL but hidden from nav.

**Cockpits:** `/inicio` · `/operador/inicio` · `/admin/inicio` · `/admin/eagle` · `/bodega/inicio` · `/contabilidad/inicio`
**Tráfico workflow:** `/traficos` · `/traficos/[id]` · `/traficos/[id]/trace` · `/traficos/[id]/pedimento` · `/traficos/[id]/pedimento/exportar` · `/traficos/[id]/pedimento/pago-pece` · `/traficos/[id]/clasificacion` · `/traficos/[id]/doda` · `/traficos/[id]/carta-porte`
**Cross-domain:** `/clientes/[id]` · `/clientes/[id]/configuracion` · `/reportes` · `/reportes/anexo-24` · `/banco-facturas` · `/corredor` · `/mve/alerts` · `/admin/carriers` · `/admin/quickbooks-export` · `/admin/clientes-dormidos` · `/admin/operadores` · `/admin/operadores/[id]` · `/admin/demo` (internal-only, admin-gated) · `/admin/notificaciones` (internal-only, admin-gated) · `/admin/auditoria` (internal-only, admin-gated)
**Warehouse:** `/bodega/recibir` · `/bodega/escanear` · `/bodega/patio` · `/bodega/[id]/avc`
**Auth + supplier:** `/login` · `/proveedor/[token]`

### V1.5 approved routes (additions)

V1.5 capstone shipped 2026-04-12. These routes join the V1 cockpit test and must pass all 10 points:

- `/bodega/escanear` (F1 — QR warehouse scan)
- `/admin/quickbooks-export` (F2 — Anabel's one-click IIF export)
- `/contabilidad` (F3 — accounting cockpit landing)
- `/admin/eagle` (F6 — Tito's morning 6-tile cockpit)
- `/admin/clientes-dormidos` (F7 — dormant client detection)
- `/traficos/[id]/trace` (F8 — end-to-end lifecycle timeline)
- `/admin/demo` (F9 — one-click synthetic demo)
- `/admin/operadores` + `/admin/operadores/[id]` (F10 — operator performance)
- `/admin/notificaciones` (F12 — Telegram routing config)
- `/admin/auditoria` (F16 — audit log viewer)

### Out-of-V1 routes

Every other route (`/voz`, `/god-view`, `/launchpad`, `/aduana`, `/comunicaciones`, `/bienvenida`, `/demo*`, `/intelligence`, `/cruz*`, `/mis-reglas`, `/calls`, `/war-room`, `/acciones`, `/financiero`, `/rentabilidad`, etc.) stays reachable by direct URL but is hidden from nav. Candidates for delete or V2.

### Brand status (post Phase 3 + 4 sweep, V1.5 capstone shipped 2026-04-12)

- User-visible `>Portal<` / `>CRUZ<` / `>ADUANA<` JSX text: **0 hits** in src/app + src/components
- User-visible title/metadata brand refs: **0 hits**
- Raw cyan hex (`#00E5FF`, `rgba(0,229,255,…)`, `rgba(34,211,238,…)`, tailwind cyan classes): **0 hits**
- Internal symbol names (AduanaChatBubble, CruzMark, CSS classes like `.aduana-dark`, cookie names, event names, URL slugs): **intentionally preserved** — cosmetic rename scheduled post-V1

### Audit references

Master audit: `docs/STATE_OF_THE_BUILD_20260412.md` — 14 sections, evidence-backed, honest 7.0/10 rating.
Per-block audits: 17 files in `docs/BLOCK*_AUDIT.md`.

### Definition of done (V1 cockpit release)

Ship V1 to production when:
1. All 26 V1-approved routes pass all 10 cockpit-test points
2. All migrations applied to Supabase (`npx supabase db push`)
3. All storage buckets provisioned (`expedientes`, `classification-sheets`, `pedimento-exports`, `anexo-24-exports`, `warehouse-photos`, `regulatory-docs`)
4. Environment vars set (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TITO_EMAIL`, `RESEND_API_KEY`)
5. Monday smoke test passes on both 1440×900 desktop and 375px phone
6. At least one real tráfico end-to-end: created → pedimento captured → classification sheet generated → PDF exported → invoice assigned from bank → PECE payment intent registered → DODA + Carta Porte generated → warehouse entry → yard staging → crossing event fires → MVE monitor doesn't alert on it

Anything short of this is pre-V1.
