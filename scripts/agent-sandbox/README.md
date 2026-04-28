# Agent Sandbox

An isolated playground for testing `src/lib/` primitives without
touching the portal, the live database, or any production surface.

## What this is

A folder with a few `run-*.ts` files you can execute directly via
`npx tsx scripts/agent-sandbox/run-<name>.ts`. Each script:

- Imports a primitive or composes a few
- Feeds in a fixture (no live DB)
- Prints the result to stdout
- Exits 0 on success, 1 on error

No side effects. No network calls (unless the primitive explicitly
needs one, in which case the script uses a mock supabase).

## When to use

- **Before writing production code** with a primitive — sanity-check
  you understand its shape.
- **Debugging a prediction / anomaly / calculation** — run the
  primitive in isolation with your suspect input, see the output
  directly.
- **Onboarding** — new Grok sessions can explore the library without
  breaking anything.
- **Demos** — paste a sandbox result into a PR or handoff to show
  what a primitive does.

## What this is NOT

- Not a test suite — tests live in `src/lib/**/__tests__/` via Vitest.
- Not a replacement for live-DB probes — those are
  `scripts/_m16-crosslink-audit.mjs` and
  `scripts/_m16-stress-test.mjs`.
- Not a place to land permanent code — this folder is for ephemeral
  exploration. Graduate a sandbox run into a proper test when the
  shape stabilizes.

## How to run

```bash
cd ~/evco-portal

# Run a single sandbox script:
npx tsx scripts/agent-sandbox/run-predict-verde.ts

# Run against live DB (for primitives that need it, NOT pure helpers):
node --env-file=.env.local --import tsx scripts/agent-sandbox/run-with-live-db.ts
```

> **`tsx`** is a TypeScript runner. If not installed,
> `npm install --save-dev tsx` first.
>
> **Live DB runs** must filter by a test tenant — NEVER run
> destructive operations against `company_id='evco'` from the
> sandbox.

## Examples

`run-predict-verde.ts` — demonstrates the Cruzó Verde predictor on
a hand-crafted fixture. No DB. Shows probability + factors + band.

`run-financial-calc.ts` — computes DTA + IGI + IVA for a sample
pedimento. No DB. Shows cascading math step-by-step.

`run-explain-prediction.ts` — renders a prediction three ways
(structured object, one-line summary, plain-text block).

## Safety rules (DO NOT BREAK)

1. **Never write to production tables** from the sandbox. Use
   `globalpc_partidas` ONLY in read mode. To test a write, use a
   local Supabase instance OR the operator-runnable seeder at
   `scripts/mafesa-seed-demo-data.mjs`.

2. **Never run destructive operations** (DELETE, TRUNCATE, DROP).
   The sandbox is for reads + pure-function exercises.

3. **Never commit** the `results/` subfolder. It's for local
   ephemeral output. Already `.gitignore`d.

4. **Pin `company_id='test'` or similar** when experimenting with
   tenant-scoped queries. `'evco'` is the real EVCO data — leave
   it alone.

## Where to read next

- Full handbook: `docs/grok-build-handbook.md`
- Quick start: `docs/GROK_QUICK_START.md`
- Primitive reference: `docs/api/` (run `npm run docs:api` to
  regenerate)
- Handbook §36: agent workflow + session ritual
