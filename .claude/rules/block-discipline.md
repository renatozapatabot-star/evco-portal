# CRUZ · Block discipline — "always gets done like this"

Codified per Renato IV's directive on 2026-04-17 after Block CC:

> "don't defer anything — we have to be able to have everything correct —
> do everything that is possible no matter how long to get it done and
> make it a 10/10 and make it in a way so it always gets done like this"

Every substantial polish cycle on this repo is a **Block** (Block AA, BB,
CC, …). Each Block follows the same six-gate discipline below. Future
sessions inherit this pattern automatically. Skipping a gate is a
regression.

---

## The six gates

### 1. Scope — clarify + plan

- Before any code, call `AskUserQuestion` when intent is ambiguous —
  especially for scope size (full reconciliation vs minimal cut).
- Write the plan to `/Users/<user>/.claude/plans/*.md` in plan mode.
- Plan includes: context, ordered phases, critical-files list, reuse
  inventory, verification block, rollback plan.
- **No deferrals** without explicit user sign-off. "Next block" escape
  hatches need a literal user approval, not assumed.

### 2. Explore — parallel Explore agents

- Launch 1–3 Explore agents **in parallel** (single tool-use block with
  multiple Agent calls) to map:
  - The data flow / queries / tables involved.
  - The existing utilities/components that can be reused.
  - The quality/contract/performance gotchas to respect.
- Use their reports to correct the plan before coding. Agent
  exploration corrections save 10× the time later.

### 3. Implement — phases in order

- Work the plan phase by phase. Track progress via `TaskCreate` +
  `TaskUpdate`.
- Resist "while I'm here" edits outside the current phase. They leak
  scope + complicate review.
- Keep changes in additive commits per phase. Rollback granularity
  beats merge-happy monoliths.

### 4. Tests — every new helper + endpoint

- New `src/lib/**.ts` file → unit tests in `__tests__/`.
- New `src/app/api/**/route.ts` → integration or parser-level tests.
- Every bug-fix from a prior block → a regression test covering it.
- Target-surface tests (company-name, quiet-season, freshness,
  safe-query, timeline, catalogo, ingest, carrier-normalize) must
  stay 100% green. Anything less blocks ship.

### 5. Ratchets — gsd-verify clean

- `bash scripts/gsd-verify.sh --ratchets-only` must pass.
- Any new hardcoded hex → constant + `// design-token` comment OR
  routed through an existing token file.
- Any new hardcoded fontSize → `var(--aguila-fs-*)` OR same-line
  `// WHY:` comment explaining the intentional exception.
- No new `console.error`/`console.warn` unless inside a soft-wrapper
  whose purpose is to surface suppressed errors (see `safe-query.ts`).

### 6. Ship — `npm run ship` + baseline

- `npm run ship` must run all six gates (pre-flight, integrity,
  rollback bundle, deploy, live smoke, baseline writer).
- Baseline file auto-writes on green: `.claude/rules/baseline-YYYY-MM-DD.md`.
- Old `baseline.md` gets a "Superseded by" pointer appended. Ratchet
  forward only — never edit a prior baseline.
- Commit messages follow `type(scope): description` convention, group
  by phase (≤ 5 commits per block).
- Post-deploy verification: curl `/api/health/data-integrity`, hit
  the primary surfaces in a browser, screenshot if human-relevant.

---

## Anti-patterns (real incidents from prior blocks)

| Incident | Anti-pattern | Block |
|---|---|---|
| `globalpc_partidas.cve_trafico does not exist` on Anexo 24 ingest | Assumed column exists without reading the schema | Block BB |
| Silent soft-wrapper zeros on /inicio | Swallowed errors without logging or surfacing | Block AA |
| RLS on `globalpc_partidas` without routing `/inicio` through service role | Applied RLS without updating all readers | pre-AA |
| Generic "try again in a few minutes" error message on Formato 53 upload | Never surface a real diagnostic back to the user | Block BB |
| Embarques 0 · Pedimentos 0 on Ursula's cockpit with no logs | Soft-wrappers swallowed the real failure cause | Block AA |

Each of these became a permanent guardrail in the codebase. The pattern
is: **when the same class of bug happens twice, it becomes a test, a
ratchet, or a rule file**. Never just a bug-fix.

---

## Before writing any code (per-file checklist)

1. **Grep first.** Find prior art. Reuse > reinvent.
2. **Blast radius.** What depends on this file? Readers + RLS + tests.
3. **Smallest change.** Solve what was asked, nothing more.
4. **Verification plan.** How will I prove it works? Answer before coding.
5. **Memory + LEARNINGS.** Read `.claude/memory/learned-rules.md` +
   `.planning/LEARNINGS.md` on complex tasks.

This list is the boot-up ritual every session runs, even implicitly.

---

## Design-integrity clause (Block DD)

The PORTAL design system (`.claude/rules/portal-design-system.md`) is the
working floor for every new surface. Every polish block after DD enforces:

- **Tokens over hex.** Every color, space, radius, shadow, duration, or
  font-size on new/migrated surfaces routes through `--portal-*` vars.
  Legacy `--aguila-*` references stay alive via the alias layer; don't
  add new ones.
- **Emerald discipline.** `--portal-green-*` is reserved for "live / healthy"
  signals. No emerald on hovers, decorative borders, or success toasts.
- **Numbers are mono.** Every KPI / timestamp / ID / fraction / pedimento
  wraps in `.portal-num` or `.portal-tabular` (both = Geist Mono + tabular-nums).
- **Null discipline.** Every render site that could emit an empty cell routes
  through `src/lib/ui/cell-renderers.tsx` (`renderNull`, `renderPending`,
  `renderCurrency`, `renderPedimento`, `renderFraccion`, etc.). Raw
  `|| '—'` / `?? '—'` / `|| 'N/A'` are ratchet violations on new code.
- **Freshness discipline.** Every authenticated trust surface carries a
  freshness signal — either `<FreshnessBanner />` or the inline
  "Sincronizado hace N min" microcopy. Never a stale number without a
  truthful freshness cue (see `.claude/rules/sync-contract.md`).
- **Focus-glow.** Every interactive element receives the emerald focus
  ring (`box-shadow: 0 0 0 2px var(--portal-ink-0), 0 0 0 3px var(--portal-green-3)`
  on `:focus-visible`) either directly or by composing a `.portal-btn`
  / `.portal-input` primitive.

Verification on ship: `bash scripts/gsd-verify.sh --ratchets-only` — no
regressions on the hex ratchet, the `fontSize: N` ratchet, or the
CRUZ-string ratchet (added in Block DD).

---

## The "no deferrals" clause

Starting Block CC, the user's directive is binding:

> All work that can be completed in this block, IS completed in this
> block. Even if the endpoint the code depends on doesn't yet exist
> (WSDL pull, SAT RFC API), ship the code paths + stubs + cron + env
> gates — when external credentials arrive, the plug-in is one env
> var away.

Practically: deferred items land as:
- Code scaffolding with clear `// TODO: endpoint pending` comments.
- PM2 cron entries that no-op until env vars are set.
- Tests that cover the logic around the external call (mock the call).

A defer is legitimate only when the user explicitly approves it via
`AskUserQuestion`.

---

## The ship command is the exit gate

Before declaring a block done:
1. Every Phase in the plan file must have a ✓ or a user-approved skip
   annotation.
2. `npm run ship` ran green end-to-end.
3. Baseline file written with new invariants appended.
4. User sees the change on the live deploy + confirms.

Anything short of that is "in progress," not "shipped." Be honest in
commits + chat summaries about what's live vs what's staged.

---

*Codified in Block CC · 2026-04-17. Every future Claude session on this
repo reads this file first.*
