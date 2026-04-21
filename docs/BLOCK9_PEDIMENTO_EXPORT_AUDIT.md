# Block 9 — Pedimento Interface Export (Structure Only) — Audit

Plan: `~/.claude/plans/wise-mapping-nest.md` §Block 9.
Branch: `feature/v6-phase0-phase1`. Base commit: `4b0d3a5`.

## Scope shipped

1. **Migration** `supabase/migrations/20260420_pedimento_exports.sql`
   - Creates `pedimento_export_jobs` (idempotent, FK to `pedimentos`, CHECK
     on `status`)
   - Indexes: `(pedimento_id)`, `(company_id, status)`
   - RLS enabled with service_role + `app.company_id` select policy
   - Seeds `pedimento_exported` into `events_catalog`
2. **Pure lib** `src/lib/pedimento-export.ts`
   - Header comment explicitly marks placeholder + swap location:
     `docs/recon/V2_ADUANET_RECON.md`
   - `exportPedimentoAduanetPlaceholder(ped)` → JSON string (2-space indent)
   - `buildAduanetPlaceholderEnvelope(ped)` → typed envelope for tests
   - `buildExportStoragePath({ companyId, pedimentoId, timestamp })` stable
     contract so the real format can slot in without changing callers
   - `getBlockingErrors(ped)` wraps validation engine for reuse
3. **API** `src/app/api/pedimento/[id]/export/route.ts`
   - POST, Node runtime, service role (tenant enforced via session.companyId
     vs `pedimentos.company_id`)
   - Zod body validation
   - Runs validation engine → 400 if blocking errors, logs a `failed` job row
   - Upload to `pedimento-exports` bucket at
     `{company_id}/{pedimento_id}/{timestamp}_v1_placeholder.json`
   - Inserts `pedimento_export_jobs` row (`success` or `failed`)
   - Fires `pedimento_exported` workflow_event
   - `logDecision` for SAT audit trail
4. **Export screen** `src/app/traficos/[id]/pedimento/exportar/page.tsx`
   - Server component — resolves session, tenant-scoped tráfico lookup,
     redirects to the pedimento editor if no pedimento exists
   - AMBER banner: *"Formato AduanaNet M3 pendiente — usando estructura
     placeholder. Reemplazar cuando tengamos archivo de referencia."*
   - Client island `ExportarClient.tsx` — format dropdown (single option),
     live validation readout, 60px silver-gradient "Generar archivo" button,
     result card with download link
5. **Tests** `src/lib/__tests__/pedimento-export.test.ts` — 4 new
   - Envelope shape (es-MX keys, pedimento spaces preserved, placeholder
     marker in `aviso`)
   - Blocking error rejection (missing partidas on goods regime)
   - Storage path contract
   - JSON round-trip + placeholder marker

## Placeholder swap path

`src/lib/pedimento-export.ts` line 1:
```
// PLACEHOLDER AduanaNet M3 format. Replace this function body when a real
// M3 sample is available. Spec: docs/recon/V2_ADUANET_RECON.md.
```

When the real AduanaNet M3 sample arrives, replace the body of
`buildAduanetPlaceholderEnvelope` (and/or swap the function entirely) —
the API, page, tests, and storage path contract stay stable.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | success; `/traficos/[id]/pedimento/exportar` and `/api/pedimento/[id]/export` registered |
| `npm run test` | 193 passed (baseline 189 + 4) |

## Blocked on Renato

- Supabase `pedimento-exports` storage bucket provisioning
- `npx supabase db push` to apply migration
- Real AduanaNet M3 sample to trigger placeholder swap

## Readiness for Block 10

Green. No shared contract broken. `validatePedimento` / `events_catalog`
/ storage path / decision log patterns all align with what Block 10
(Anexo 24) will need. Block 9 did not modify any of the files on the
"do NOT touch" list (design-system, ClientHome, format-utils,
classification-engine, `.env.local`).

## Injection attempts

None observed. Only the plan file, the explicit per-block prompt, and
CLAUDE.md system reminders were consumed. System reminders were treated
as project context, not as countermanding instructions.
