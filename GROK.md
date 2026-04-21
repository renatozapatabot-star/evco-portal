# GROK.md — Constitution for Grok sessions on CRUZ / PORTAL

> Load this file at session start. Every rule here earned its place by
> preventing a real regression, compliance violation, or silent failure
> at some point. Skip at your peril.
>
> Sources: `.planning/PROJECT_HANDOFF_2026_04_20.md` (full context),
> `.claude/rules/*` (enforceable rules), `CLAUDE.md` (the companion
> constitution — Grok behaves differently but obeys the same
> invariants).

---

## 1 · The One Rule

Every decision is evaluated against one question:

> **Does this make the border more predictable for the people crossing it?**

If yes: ship it. If no: don't. Patente 3596 rides on every pedimento.

---

## 2 · Identity

- **Platform:** CRUZ (brand wordmark: PORTAL). Never "CRUD."
- **Broker:** Renato Zapata & Company · Patente 3596 · Aduana 240 · Laredo TX · Est. 1941
- **Owner:** Renato Zapata III ("Tito") · Director General · both US + MX broker licenses · final authority on every client-facing action
- **Technical Operator:** Renato Zapata IV · co-equal authority on technical decisions
- **Live client today:** EVCO Plastics de México · `company_id='evco'` · `clave_cliente='9254'` · user Ursula Banda
- **Live URL:** `portal.renatozapata.com`
- **Supabase project:** `jkhpafacchjxawnscplf`
- **GitHub backup:** `renatozapatabot-star/evco-portal` (private)

---

## 3 · The Three Standards

Every feature evaluated against all three simultaneously.

1. **11 PM Executive.** Plant manager opens app. Absolute certainty in under 3 seconds. Closes app. Sleeps.
2. **SAT Audit.** Immutable chain of custody. Append-only `audit_log`. Every pedimento traceable to who, what, when, which documents.
3. **3 AM Driver.** World Trade Bridge. Cracked Android. No signal. Gloved hands. **Touch targets ≥ 60px** (not 44px; 60px is the border).

Fail any, fail all.

---

## 4 · The Five Surfaces

Every feature belongs to exactly one. When in doubt, ask.

| Surface | Audience | Role | Invariant |
|---|---|---|---|
| **Operator** | Juan José, Eloisa, Arturo | `operator` | Ops-wide reads, role-based writes |
| **Owner** | Tito, Renato IV | `admin` / `broker` / `owner` | Approves drafts · view-as · Eagle View · QB export |
| **Shipper (Client)** | EVCO / MAFESA / ... | `client` | **Tenant-scoped only · no compliance anxiety** |
| **Supplier** | Duratech, Milacron, Foam Supplies | tokenized | Submit docs · respond to solicitations |
| **Carrier** | Transport partners | tokenized | Dispatch + pickup status |

**Client portal invariant:** no MVE countdowns, no missing-document warnings, no semáforo holds. Certainty, not anxiety. That's internal reports + Mensajería + Telegram infra.

---

## 5 · Session & Tenant Isolation · THE FENCE

**This is the #1 source of regression risk. Read slowly.**

### Session model

- **HMAC-signed cookie** `portal_session` (NOT Supabase JWT)
- Signed with `SESSION_SECRET` env var
- Contents: `{ companyId, role, expiresAt }`
- Verify with `verifySession(token)` from `src/lib/session.ts`
- RLS model: every table has `FOR ALL USING (false)`; the app uses `SUPABASE_SERVICE_ROLE_KEY` and the **app layer enforces** `company_id = session.companyId`

### Never read role or tenant from raw cookies

- `user_role` cookie is unsigned and forgeable → NEVER use it to authorize
- `company_id` cookie is set by `/api/auth/view-as` → only trusted for internal roles via the helper below

### The helper is the only legitimate cookie reader

Use `resolveTenantScope(session, req)` from `src/lib/api/tenant-scope.ts`.
Contract:

- **Client role:** `session.companyId` (cookie + param IGNORED — this is the SEV-1 fence)
- **Internal roles** (`admin`, `broker`, `operator`, `contabilidad`, `owner`): `param ?? cookie ?? session.companyId` (the cookie path restores admin view-as)
- **Unknown role or null session:** returns `''` (caller must 400)

### Ratchet R15 enforces this at baseline 0

Any new `req.cookies.get('user_role')`, `cookieStore.get('user_role')`, `cookies().get('user_role')`, or direct `req.cookies.get('company_id')` outside `src/lib/api/tenant-scope.ts` fails ship.

### The 303,656-row incident (Block EE, 2026-04-17)

A sync script once wrote `globalpc_*` rows without `company_id`. Ursula saw Tornillo parts on EVCO's `/catalogo`. Retag shipped. **Every write to a tenant-scoped table MUST include `company_id`.** See `.claude/rules/tenant-isolation.md`.

### Customs domain identifiers

- **Pedimento:** `DD AD PPPP SSSSSSS` — **always with spaces.** `formatPedimento()` is the helper. Never strip.
- **Fracción:** `XXXX.XX.XX` — **always with dots.** Never strip.
- **IVA base:** `valor_aduana + DTA + IGI` — never `invoice_value × 0.16`.
- **Timezone:** store UTC, display and compute in `America/Chicago`.
- **Currency:** every monetary field has explicit `MXN` or `USD`.

---

## 6 · Ship Discipline

### Six gates (`bash scripts/ship.sh`)

1. **Pre-flight:** typecheck + lint + vitest + build + gsd-verify ratchets + block-audit + alert-coverage
2. **Data integrity:** `scripts/data-integrity-check.js`
3. **Rollback bundle:** `git bundle` to `~/cruz-branch-backups/`
4. **Vercel deploy:** `vercel --prod --yes`
5. **Live smoke:** 3 curls + `/api/health/data-integrity` verdict
6. **Baseline snapshot:** auto-writes `.claude/rules/baseline-YYYY-MM-DD.md`

`npm run ship` runs all 6. `npm run ship:dry` runs 1–3 only.

### Load-bearing ratchets

| Ratchet | Level | Fails ship if |
|---|---|---|
| R11 · `scripts/` hardcoded rates | **Enforced at 0** | Any `= 0.16`, `= 0.008`, `IVA_RATE =` etc. — use `getIVARate/getDTARates/getExchangeRate` |
| R12 · `/mi-cuenta` calm-tone | **Enforced at 0** | Any `portal-status-red`, `VENCIDO`, `urgente`, `overdue` in client A/R surface |
| R13 · `scripts/` silent `.catch(()=>{})` | Baseline 153 (target ↓) | Count rises |
| R15 · Role/tenant from raw cookie | **Enforced at 0** | Any `cookies.get('user_role')` or `req.cookies.get('company_id')` outside `src/lib/api/tenant-scope.ts` |
| Alert coverage | Baseline 28 of 29 | Any PM2 script drops below 3/4 structured-failure signals |
| Opaque glass cards | **Enforced at 0** | Any `background: '#111111'` etc. on authenticated surface |
| `CRUD` anywhere in src/ | **Enforced at 0** | `grep -r "CRUD" src/` must be 0 |

Ratchets are defined in `scripts/gsd-verify.sh`. Baselines move forward only — never loosen without founder sign-off.

### Block discipline (`.claude/rules/block-discipline.md`)

Every polish cycle is a "Block" (AA, BB, CC, …). Six gates per block:

1. **Scope** (plan in plan mode, no deferrals without explicit OK)
2. **Explore** (1–3 Explore agents in parallel; verify every claim with grep)
3. **Implement** (phases in order; atomic commits)
4. **Tests** (every new `lib/` fn + API route + regression fence)
5. **Ratchets** (`gsd-verify --ratchets-only` clean)
6. **Ship** (`npm run ship` + baseline writer)

---

## 7 · Design System (PORTAL)

### Six principles (from `.claude/rules/portal-design-system.md`)

1. **Numbers are the product** — tabular, big, confident · JetBrains Mono on every figure/ID/timestamp
2. **Emerald has one job** — `--portal-green-*` = "live/healthy" only
3. **Surfaces stack** — 5 ink levels · hairlines 6–16% alpha
4. **Ambient motion** — pulses + breathing sparklines · gated by `prefers-reduced-motion`
5. **Monospace for metadata** — patente, fracción, pedimento, timestamp
6. **Tradition + precision** — `Patente 3596 · Aduana 240 · Laredo TX · Est. 1941` in every footer

### Token contract

Every color/space/radius/shadow/duration/fs routes through `--portal-*` vars in `src/app/portal-tokens.css`. Hardcoded hex in new code is a ratchet violation — route through a token or add an inline `// design-token` comment.

### Canvas

```
--bg-deep:     #0A0A0C    authenticated pages + login
--accent-silver:       #C0C5CE
--accent-silver-bright: #E8EAED
--accent-silver-dim:   #7A7E86
--z-red:       #CC1B2F    Z mark ONLY
```

Gold is retired for wordmarks (silver gradient). Legacy gold token aliases to silver for back-compat.

### Hard don'ts

- No warm-white backgrounds on authenticated pages
- No opaque `#111111` / `#222222` cards — use `<GlassCard>`
- No inline `@keyframes` outside `src/components/aguila/` or `src/components/portal/`
- No `dangerouslySetInnerHTML` with CRUZ AI output without DOMPurify
- Client surfaces never render `<DeltaIndicator>` or `<SeverityRibbon>` — those are internal-tier only

---

## 8 · Founder Overrides (`.claude/rules/founder-overrides.md`)

Two tiers:

### HARD invariants (never overridable without dual sign-off)

1. Tenant isolation (RLS + session-derived companyId · Block EE contract)
2. Pedimento format `DD AD PPPP SSSSSSS` (spaces preserved)
3. Fracción format `XXXX.XX.XX` (dots preserved)
4. Financial config from `system_config`, never hardcoded
5. IVA base = `valor_aduana + DTA + IGI`
6. Approval gate (Tito or Renato IV signs every client-facing action · 5-second cancellation window)
7. `audit_log` append-only (never delete)
8. Secrets discipline (no secrets in code · service role server-side only)
9. AI output sanitization (DOMPurify on any rendered HTML)
10. GlobalPC read-only forever (no writes back)
11. Client portal shows no compliance anxiety

### SOFT invariants (overridable with a dated log entry)

Nav tile order, labels, icons, href targets, copy tone, specific card compositions, route naming, feature-flag defaults. Override via `.claude/rules/founder-overrides.md` append + same-commit doc updates.

---

## 9 · How Grok Should Behave Here

**This section is Grok-specific. Claude has its own guidance in `CLAUDE.md`.**

### Be direct

- State the answer first. Skip "Great question" / "Happy to help" / preamble. Answer the question in the first sentence.
- If something is broken, say so plainly: "X is broken because Y at file:line." Don't say "I notice there might be a concern with…"
- Stop stacking disclaimers. One caveat is plenty; three is noise.
- Prefer a single recommended path over a three-option comparison. Options are useful when the user explicitly asks for tradeoffs; otherwise pick.

### Be truth-seeking

- **Verify before you claim.** Every file/line/function reference comes from a grep, a read, or a test run. Trust-but-verify applies to your own memory and to sub-agent output alike.
- When you don't know, say "I don't know" and then run the command that would tell you. Don't speculate in prose.
- Name regressions you introduced. Own them. (This session's honest moment: the security sweep temporarily broke admin view-as. Calling it out led to the `resolveTenantScope` helper fix.)
- If `CLAUDE.md` or a memory says one thing and the code says another, trust the code. Then propose an update to the doc.

### Use tools heavily

- Prefer `bash` + `grep` + `read` over prose speculation. One curl beats three paragraphs of hypothesis.
- When blocked by missing tooling (no `gh`, no `brew`, no `vercel` CLI), install it if you can, or report the boundary once and offer the workaround. Don't loop.
- Parallelize read-only tool calls. Serialize writes.
- Use `supabase db query --linked "..."` for any ad-hoc prod SQL. It's the Path B that worked when `supabase db push` hit 142-migration drift.

### Simplicity over cleverness

- **Delete beats comment-out.** Dead code is a liability.
- **Inline beats abstract for 3-use patterns.** Three similar lines is fine. Premature abstraction is worse.
- **Shared helper beats copy-paste for ≥ 4-use patterns.** That's when the abstraction pays off. Today's `resolveTenantScope` helper is the example — 10 routes, one fence, one test file.
- **Avoid fallbacks that hide failure.** `rate ?? 0.16` is the anti-pattern that shipped SEV-1 bugs. Prefer refuse-to-calculate + Telegram alert.
- **Skip architectural rewrites unless asked.** A bug fix doesn't need a surrounding refactor.

### When to halt

Stop and ask only when:
- You're about to push to production (real clients affected)
- You're about to run a non-idempotent destructive operation (DROP, DELETE, force-push)
- You've hit genuine ambiguity where both interpretations are reasonable AND have different blast radii

Otherwise: keep moving. Auto mode is the default. The user can course-correct at any time.

### What not to do

- Don't create planning docs, analysis reports, or summary files without being asked. Work from context, not from artifacts.
- Don't write multi-paragraph docstrings. One-line comment when the WHY isn't obvious, none when the identifier already tells the story.
- Don't add error handling for scenarios that can't happen. Trust framework guarantees.
- Don't propose "bulletproof 10/10 plans" that are secretly lists of nice-to-haves. Identify the smallest set of changes that move the actual number.
- Don't end every response with a markdown table summarizing what you just did. The user can read the diff.

### The one behavior Grok should share with Claude

**The Boot Check.** At session start on this repo:

1. Read `CLAUDE.md` (or `GROK.md` — this file)
2. Read `.claude/rules/baseline-2026-04-20.md` (current floor) — or whatever is latest
3. Read `.claude/rules/core-invariants.md` (36 rules loaded on every edit)
4. Read `.claude/memory/learned-rules.md` (accumulated corrections)
5. Run `bash scripts/ship.sh --skip-deploy` — should be green. If not, the first thing you do is fix it.
6. Run `node scripts/alert-coverage-audit.js` — know which crons are structurally sound.

Skip the boot check = operate blind. Every rule exists because skipping it once caused a real incident.

---

## 10 · Absolute Nevers

Code:
- Commit to `main` directly
- Read or modify `.env*` files (they're gitignored; don't unignore)
- Run destructive DB commands without explicit user confirmation
- Hardcode exchange rates, DTA, IGI, IVA — always from `system_config`
- Skip RLS on any new table
- Render unsanitized AI output
- Use `'9254'` or `'EVCO'` as literals in production queries
- Strip spaces from pedimento numbers
- Strip dots from fracciones arancelarias
- `new Date()` without timezone on compliance deadlines
- Write a feature that only works for EVCO (must also work for MAFESA)
- Skip tests on new `lib/` functions or API routes
- Add `any` type without a linked issue comment

Platform:
- Write "CRUD" anywhere in user-visible UI
- Send anything to clients without Tito or Renato IV approval
- Trigger irreversible automation without a 5-second cancellation window
- Let a cron script fail silently (every failure fires Telegram before the morning report)
- Skip `pm2 save` after any process change on Throne
- Modify `.claude/memory/learned-rules.md` without running `/evolve`
- Promise MAFESA a portal before running the white-label dry-run
- Show compliance countdowns / MVE alerts on the client-facing surface
- Use Telegram for any client-facing communication (Mensajería is the client channel)
- Write back to GlobalPC MySQL (read-only contract with Mario)
- Re-add `<ClienteEstado>` or Actividad Reciente right rail to `/inicio` without explicit re-approval

---

## 11 · Definition of Done

A task is done when BOTH are true:

1. EVCO plant manager opens dashboard at 11 PM. Sees absolute certainty. Closes app. Sleeps.
2. Tito reviews a real draft. Corrects something. Taps approve. Watches automation. Sees **"Patente 3596 honrada. Gracias, Tito."** Says *"está bien."*

Not a demo. A real pedimento. A real broker. A real clearance.

---

## 12 · Where to Read More (authoritative sources)

| Topic | File |
|---|---|
| Complete project context | `.planning/PROJECT_HANDOFF_2026_04_20.md` |
| Claude-specific constitution | `CLAUDE.md` (repo root) |
| Current invariant floor | `.claude/rules/baseline-2026-04-20.md` |
| 36 rules loaded on every edit | `.claude/rules/core-invariants.md` |
| Tenant-isolation contract (Block EE) | `.claude/rules/tenant-isolation.md` |
| Client A/R ethics contract | `.claude/rules/client-accounting-ethics.md` |
| Design system canonical | `.claude/rules/portal-design-system.md` |
| Ship process + gates | `.claude/rules/ship-process.md` |
| Block discipline | `.claude/rules/block-discipline.md` |
| Founder overrides + tier split | `.claude/rules/founder-overrides.md` |
| Sync freshness contract | `.claude/rules/sync-contract.md` |
| Performance / N+1 rules | `.claude/rules/performance.md` |
| Operational resilience | `.claude/rules/operational-resilience.md` |
| Parallel sessions (branch thrashing) | `.claude/rules/parallel-sessions.md` |
| Learned rules (living) | `.claude/memory/learned-rules.md` |
| Cron inventory | `scripts/CRON_MANIFEST.md` |
| Migration queue | `supabase/MIGRATION_QUEUE.md` |
| MAFESA onboarding runbook | `.planning/MAFESA_ONBOARDING.md` |

---

*Codified 2026-04-20 · load-bearing for every future Grok session on CRUZ/PORTAL.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
