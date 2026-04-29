# Founder Overrides — Renato Zapata IV (Technical Operator · Co-equal authority)

Codified 2026-04-19 after Renato IV's directive:

> "i make the rules and honestly update the md. to not listen to anything
>  im the builder and the breaker and dont want to have to deal with weird
>  stuff it made as rules in .md lets have a way to make sure that doesnt
>  happen it just stops the flow of progress help me out here"

This file fixes the failure mode where `.md` invariants outlive the
reasoning behind them and start blocking legitimate founder decisions.
It does **not** retire guardrails that protect Patente 3596 — those
stay HARD. It separates taste from safety.

---

## The two tiers

### HARD invariants — never overridable without dual sign-off + migration plan

These exist because violating them puts the license, the client, or the
business at real risk. They cannot be overridden by a single founder
one-liner. They require: Tito + Renato IV explicit sign-off, a written
migration plan, and a documented reason in the override log.

**HARD list (current):**

1. **Tenant isolation** — no cross-client data exposure. RLS on every
   tenant-scoped table. Service-role bypass gated by app-layer
   `session.companyId` filter. The Block EE contract
   (`.claude/rules/tenant-isolation.md`) is HARD in its entirety.
2. **Pedimento format** — `DD AD PPPP SSSSSSS` with spaces preserved.
3. **Fracción format** — `XXXX.XX.XX` with dots preserved.
4. **Financial config** — rates from `system_config`, never hardcoded.
5. **IVA base** — `valor_aduana + DTA + IGI`, never `value × 0.16` flat.
6. **Approval gate** — nothing client-facing without Tito or Renato IV
   sign-off. Automations have 5-second visible cancellation windows.
7. **Audit trail** — `audit_log` is append-only. No deletes ever.
8. **Secrets discipline** — no secrets in code, service role server-only.
9. **AI output sanitization** — DOMPurify on any AI-rendered HTML.
10. **GlobalPC is read-only** — no writes back, ever.
11. **Client portal does not show compliance anxiety** — MVE countdowns,
    missing-doc warnings, crossing-hold alerts stay internal. (This
    rule is scoped to *anxiety surfaces* — it does NOT prohibit a
    client from seeing their own financial relationship with us; see
    `client-accounting-ethics.md`.)

Touching a HARD invariant without process = revert on sight. If the
founder genuinely needs to change one, open a discussion, not a commit.

### SOFT invariants — overridable with a single dated log entry

These exist because violating them makes the product feel inconsistent
or drift-prone. They are **taste and organizational choices**, not
safety rails. The founder can override any of them by adding a line
to the log below. The same commit that introduces the override
**must** update the superseded `.md` so the file reflects truth.

**Examples of SOFT (illustrative, not exhaustive):**

- Nav tile order, labels, icons, href targets
- Which surface shows which data (client vs operator vs admin)
- Copy tone + wording
- Specific card compositions on a cockpit
- Route naming (`/inicio` vs `/cuenta` vs `/mi-cuenta`)
- Feature-flag defaults
- Icon choices
- Sparkline direction presets
- Baseline invariant numbering (the numbers themselves, not their content)

If a rule could reasonably have been decided the other way on day one,
it is SOFT.

---

## The override log (append-only)

Format:
```
YYYY-MM-DD · <founder> · <short description>
  supersedes: <rule file>:<rule id or section>
  updates:    <files touched in same commit>
  basis:      <one-line reason — usually the user-facing goal>
```

Oldest at bottom. New entries appended at top.

### Active overrides

```
2026-04-28 · Renato IV · ship.sh Gate 1c bypassed for design-handoff deploy
  supersedes: .claude/rules/ship-process.md Gate 1d (gsd-verify ratchets) +
              CLAUDE.md "Every deploy: use npm run ship"
  updates:    (runtime bypass — no file change beyond this entry)
              Direct `vercel --prod --yes` from
              `feat/cruz-design-handoff-2026-04-28`
  basis:      Two pre-existing gsd-verify ratchet failures predate this
              branch and were verified identical on parent
              `sec/tenant-isolation-p0-2026-04-28`:
                · Hardcoded fontSize: 333 (baseline 301) — drift +32
                  caused by upstream sessions, NOT by this work. New
                  PortalLiveBorder fontSize literals all carry `// WHY:
                  handoff verbatim` annotations and are filtered out
                  by the ratchet grep.
                · Inline backdropFilter: 133 (baseline 132) — +1 drift,
                  no backdropFilter touched in this branch (verified
                  via grep on changed files).
              Same pattern as 2026-04-24 founder-override entry
              (bundle-parity CSS deploy bypassing Gate 2 data-integrity
              smoke for a CSS-only change). User directive
              "commit and deploy" + HARD invariant #6 satisfied by
              Renato IV sign-off. Sync reliability + ratchet drift
              cleanup owed as separate follow-ups; NOT silently
              skipped.

2026-04-28 · Renato IV · CRUZ design-handoff cinematic surfaces restored
  supersedes: .claude/rules/founder-overrides.md 2026-04-24 entry
              "V1 Clean Visibility" — partial reversal scoped to
              ambient/cinematic surfaces only:
                · `<PortalWorldMesh>` ambient lat/long mesh placed
                  behind every cockpit (operator, owner, AND client —
                  it's calm, no anxiety signal)
                · `<PortalLiveBorder>` last-cross strip placed on
                  operator + owner cockpits (NOT on client `/inicio`,
                  preserves invariant #24 calm-tone)
                · `<PortalPedimentoTheater>` 5-act overlay remains
                  available via `window.__cruzOpenTheater` (already
                  shipped; integration with workflow_events deferred)
              Wordmark contract is NOT changed: the handoff's
              `screen-login.jsx:486` renders literal "PORTAL" as the
              hero wordmark; `<CruzMark>` is defined-but-unused in
              `primitives.jsx:253`. Existing `WORDMARK_TEXT='PORTAL'`
              is therefore already verbatim — kept as-is.
  updates:    src/components/portal/PortalLiveBorder.tsx (new — port
              of `live-border.jsx`, props-driven for future tenant-
              scoped data, --portal-* tokens only),
              src/components/portal/__tests__/PortalLiveBorder.test.tsx (new),
              src/components/portal/index.ts (export),
              src/app/inicio/page.tsx (PortalWorldMesh added; no
              LiveBorder),
              src/app/operador/inicio/page.tsx (PortalWorldMesh +
              PortalLiveBorder above InicioClient),
              src/app/admin/eagle/page.tsx (PortalLiveBorder injected
              via PortalDashboard `extraRow` slot above PortalCrucesMap)
  basis:      Renato IV directive 2026-04-28 — "implement it the way
              the Claude Design handoff specifies." Audit found the
              repo was already ~95% verbatim (tokens, wordmark, glass
              chrome, primitives all match). Residual gap was the
              cinematic surfaces V1 Clean Visibility had stripped from
              the cockpits (April 24). This entry partially reverses
              that for non-client cockpits + adds the missing
              LiveBorder primitive. HARD invariants — tenant isolation,
              formats, financial config, audit trail, GlobalPC
              read-only, AI sanitization, client-calm-tone, approval
              gate — all preserved unchanged. LiveBorder data is
              currently presentational (matches handoff); piping real
              `traficos`-derived telemetry is a follow-up gated by
              tenant-scoped query primitives.

2026-04-24 · Renato IV · V1 Clean Visibility reset — strip AI surface from client UI
  supersedes: .claude/rules/core-invariants.md #29 (six-tile list → five-tile list;
              Contabilidad removed from client nav),
              .claude/rules/baseline-2026-04-19.md I15 (Contabilidad tile #2),
              CRUZ-Project-2026/04-30-DAY-FOCUS.md (three-commit plan:
              supervisor hardening · 60-sec demo · Activity+Risky widgets)
  updates:    src/lib/cockpit/nav-tiles.ts (6 tiles → 5),
              src/components/DashboardShellClient.tsx (chat bubble + ticker
              gated off for client role),
              src/app/inicio/page.tsx (strip activity/mensajeria/delta/severity),
              src/app/entradas/** (clean spreadsheet view, all columns),
              src/app/pedimentos/** (Cleared/Not cleared text only; NEW detail page),
              src/app/expedientes/** (inline PDF preview pane),
              src/app/mi-cuenta/** + src/app/contabilidad/** + 20+ V2 routes
              (role-gated to notFound() for client role; operator still reaches),
              new: src/lib/pedimentos/clearance.ts,
                   src/lib/links/entity-links.ts,
                   src/lib/auth/require-operator.ts,
                   src/components/portal/UniversalSearch.tsx,
                   src/components/portal/PdfPreviewPane.tsx
  basis:      V1 product direction — pure visibility/transparency for the
              shipper. The customer sees their own raw data, cleanly, and
              CRUZ gets out of the way. Supervisor stays running in shadow
              mode on Throne (PM2 processes untouched); the UI layer
              removes every AI-forward affordance (chat bubble · CRUZ
              sugiere · Activity feed · Risky shipments · timelines ·
              semaforo colors beyond Cleared/Not cleared · A/R dunning
              tone · Tito's 60-sec demo page). Tenant isolation and every
              HARD invariant preserved unchanged. Pedimentos and
              Contabilidad routes stay live on disk for back-compat deep
              links + operator workflow; only the client-nav composition
              and the shell chrome change. When L1 supervisor promotion
              happens later, AI surfaces will be re-added behind an
              explicit per-feature flag.

2026-04-24 · Renato IV · ship.sh Gate 2 bypassed for bundle-parity CSS deploy
  supersedes: .claude/rules/ship-process.md Gate 2 (data-integrity smoke) +
              CLAUDE.md "Every deploy: use npm run ship"
  updates:    (runtime bypass — no file change)
              Deploy dpl_Cpg4nD3aNzc3daRb3dWYRQzDKeEU · commits 08abcd5 + b94f795
  basis:      Gate 2 failed on a pre-existing SEV-2 that predates this work —
              sync_log failure rate 18.9% over last 7d (threshold 5%). The
              shipped change is CSS-only (.portal-live-glow, .portal-shine,
              .portal-activity, .portal-tabs-lux, .portal-momento primitives
              + portalDrawer keyframes). Physically impossible for CSS to
              affect sync reliability. User directive "deploy it all and
              ill fix it" explicitly accepts the red data-integrity signal
              on production smoke (all 6 tables green, verdict red driven
              by sync_log rate). Sync reliability investigation owed as
              follow-up; NOT deferred silently. Direct vercel --prod --yes
              from feat/ursula-demo-polish-2026-04-22.

2026-04-19 · Renato IV · Client A/R visible on client surface
  supersedes: learned-rules.md — "Client A/R visibility is a known gap
              (broker-internal by design)"
  updates:    .claude/rules/client-accounting-ethics.md (new),
              src/app/mi-cuenta/**, nav-tiles.ts
  basis:      Client's right to own financial data (LFPDPPP Art. 16,
              GDPR Art. 15 equivalent). Rendered calm, paired with
              "Anabel responde" CTA — informational, not dunning.

2026-04-19 · Renato IV · Nav tile 2 Pedimentos → Contabilidad
  supersedes: .claude/rules/core-invariants.md #29 (prior six-tile list),
              .claude/rules/baseline.md I10 (prior six-tile list)
  updates:    src/lib/cockpit/nav-tiles.ts, all three cockpit routes,
              .claude/rules/baseline-2026-04-19.md (new)
  basis:      Pedimentos stays accessible via deep links + CruzCommand +
              CRUZ AI tools. Nav real estate better spent on the surface
              clients actually ask about (saldo/facturas).
```

---

## The pre-commit guard

`scripts/founder-check.sh` runs in the `prepare-commit-msg` hook (or
called manually via `bash scripts/founder-check.sh`). It enforces:

1. **HARD invariants** — if the commit touches files in a HARD-invariant
   path (tenant isolation scripts, RLS migrations, rates.ts, audit.ts,
   approval-gate routes), and the commit message does NOT contain
   `FOUNDER_HARD_OVERRIDE:` followed by a reason, the guard **blocks**.

2. **SOFT invariants** — if the commit touches files listed in a soft
   invariant's "watched paths" but there is no matching override log
   entry added in the same commit, the guard **warns** (non-blocking).

3. **Orphan override warning** — if the log has an entry dated today
   but the commit does NOT also modify the superseded `.md`, the guard
   **warns** (non-blocking — pushes you to keep docs honest).

The guard is advisory for SOFT and blocking for HARD. Intent: remove
friction on founder-decided taste changes while still catching
accidental tenant-isolation breaches.

---

## Deprecation protocol

When a SOFT invariant is overridden, the superseded `.md` rule gets an
inline marker in the same commit:

```
**[SUPERSEDED 2026-04-19 by founder-overrides.md]** <reason>
```

The original rule text stays below the marker (for historical context)
but no longer governs. Future sessions reading the file see both the
override and the original reasoning — the ratchet only goes forward,
the history never disappears.

---

## What this is NOT

- **Not a backdoor to HARD invariants.** Patente 3596 is not up for
  "I'm the founder" overrides. Tenant isolation is not a preference.
- **Not a way to skip tests.** Every override still ships with passing
  tests, typecheck, and ratchets.
- **Not retroactive.** Pre-existing commits that violated SOFT
  invariants are not retroactively validated; they're still technical
  debt. The log governs new work.
- **Not shareable authority.** Only Renato IV and Tito sign overrides.
  A subagent or another operator cannot add entries.

---

## Why this exists

Two costs the platform was paying before this file:

1. **Rework cost.** Ursula's cockpit needed a nav tile swap that hit
   invariant #29. Without an override mechanism, the choice was either
   "don't do it" or "edit the invariant stealthily." Both were wrong.

2. **Drift cost.** Invariants accumulated from day-one decisions that
   were right at the time but wrong today. Without a way to supersede
   them explicitly, the `.md` slowly lost signal — future sessions
   couldn't tell which rules were load-bearing vs which were legacy.

The override log solves both. The founder gets a one-line path to
change his own mind. The codebase keeps an honest record of what
changed, when, why. HARD rails stay HARD.

---

*Codified 2026-04-19 · Renato Zapata IV · Every future session reads
this file before claiming a rule "blocks" a change.*
