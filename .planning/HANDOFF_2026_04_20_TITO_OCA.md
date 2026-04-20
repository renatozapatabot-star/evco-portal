# HANDOFF · Tito OCA Classifier — session 2026-04-20

Branch: `feat/tito-oca-classifier-2026-04-20` (worktree at
`~/evco-portal-tito-oca`, forked from the PDF-fix branch at 79b9301).
Plan: `~/.claude/plans/binary-floating-lecun.md`.
Golden fixture: invoice #4526219 (4 unknowns Tito must classify:
18MB, 28MB, BG600E, W-5).

---

## What's RUNNING (commits on this branch)

| SHA | Phase | Scope | Tests |
|---|---|---|---|
| `20e219c` | Phase 0 | Golden fixture + acceptance fence (5 checks + 5 it.todo) | 5/5 |
| `416290e` | Phase 1 | Schema migration queued (oca_database + companies.signature_image_url) | — |
| `42f88ff` | Phase 2 | Sonnet-vision `invoice-extract.ts` (PDF/image → structured parts) | 9/9 |
| `9a237bc` | Phase 3 | `resolve-parts.ts` — 4-source auto-resolver + tenant isolation | 13/13 |
| `2969d85` | Phase 4 | Opus Classifier generator: full OCA template + `generateOcaBatch` | 11/11 |

**Aggregate:** 45/45 tests green in `src/lib/oca`, 5 `it.todo` for the
end-to-end pipeline that land in Phase 5+. Typecheck clean.

The intelligence pipeline is complete end-to-end as a library:
```
bytes ─▶ invoice-extract (Sonnet)
          ├─▶ InvoicePart[]
          ▼
       resolve-parts (Supabase)
          ├─▶ resolved rows (no Opus needed)
          └─▶ needs_classification rows
               ▼
            generate.generateOcaBatch (Opus, concurrency 2)
               └─▶ OcaClassifierDraft[] (full I/II/III/IV template)
```

## What's PENDING (from the plan)

### Phase 5 — API routes (next up)

Three thin route handlers in `src/app/api/oca/` that compose the
libraries above:

1. `POST /api/oca/extract-invoice`
   - Body: `{ file_key?: string, pdf_base64?: string }`
   - Auth: `session.role in ['admin','broker','operator']`
   - Rate-limit: 3/min/user via `src/lib/rate-limit-db.ts`
   - Calls `extractInvoice()` + inserts `api_cost_log`
   - Returns `InvoiceExtraction`

2. `POST /api/oca/classify-batch`
   - Body: `{ invoice_ref, company_id, parts: OcaClassifierInput[] }`
   - Auth: `session.role in ['admin','broker']`
   - Rate-limit: 10/min/user
   - Calls `resolveInvoiceParts()` + `generateOcaBatch()` (only for
     `needs_classification` items) + inserts draft rows into
     `oca_database` with `status='draft'`
   - Returns `{ resolved: ResolvedPart[], drafts: OcaRow[] }`

3. `POST /api/oca/[id]/sign`
   - Body: `{ corrections?: Record<string, Partial<OcaRow>> }`
   - Auth: `session.role in ['admin','broker']` (TITO surface)
   - 5-second server-side delay window — if `DELETE /api/oca/[id]/sign`
     arrives within 5 s, abort. Core-invariant 22.
   - On sign: `oca_database` UPDATE status='approved', approved_by, approved_at
   - Inserts `classification_log` row with supertito_agreed (or
     supertito_correction on inline edit) — SuperTito learning loop
   - Audit log: `action='oca_signed'`

**Gotcha:** every route handler reads session via `src/lib/session.ts`,
NEVER cookies directly (baseline-2026-04-20 I20 — forgeable-cookie
elimination). Pattern: `const session = await getSession(req)`.

**Test fences (baseline-2026-04-20 I26):** each route gets a
`__tests__/tenant-isolation.test.ts` that asserts (a) client role
sees a 403, (b) admin sees full surface, (c) cookie forgery of
`company_id` cannot cross-tenant.

### Phase 5.5 — taste primitives

New files (plan §Phase 5.5):
- `src/app/settings/signature/{page,error,loading}.tsx` + `/api/settings/signature/route.ts` — PNG upload (≤ 2 MB) → `companies.signature_image_url`. Admin/broker only.
- `src/components/oca/KeyboardShortcutsRibbon.tsx` — `.portal-kbd` strip (j/k/Enter/Ctrl+Enter/Esc/?)
- `src/components/oca/SessionCostBadge.tsx` — "Costo estimado: $0.42 USD"
- `src/lib/oca/smart-defaults.ts` — origen=US, moneda=USD, TMEC auto-compute, vigencia 365 d

### Phase 6 — UI rewrite

- Rewrite `src/app/clasificar-producto/page.tsx` to compose
  `<PageShell>` + `<GlassCard>` + `<AguilaDataTable>` + `<AguilaFooter>`.
- Move-and-rewrite `src/components/client/SelfClassify.tsx` →
  `src/components/oca/TitoClassifier.tsx` (495-line inline-glass
  component → primitive composition). Old file becomes a 3-line
  re-export shim for back-compat.
- Add `src/app/clasificar-producto/error.tsx` + `loading.tsx`
  (invariant 36 — every authenticated cockpit has both).
- Role gate: `session.role in ['admin','broker']`. Client role gets
  a 403 page with Mensajería CTA.

### Phase 7 — PDF generator

- `src/lib/oca/pdf.tsx` — `@react-pdf/renderer` Document with flat
  fills ONLY (no gradients — avoids the pre-existing
  `@react-pdf/pdfkit` gradient bug documented in
  baseline-2026-04-19 pre-existing failures).
- Renders the I/II/III/IV template + typed "/s/ Renato Zapata III"
  + optional signature image above when
  `companies.signature_image_url` is set.
- Writes PDF to `oca-documents` Storage bucket.

### Phase 8 — delivery

- `src/lib/oca/notify.ts` (rename from the plan's `email-summary.ts` —
  per user directive, drop the Juan-José-style framing). Compose a
  PORTAL-native Mensajería thread to Eloisa OR email fallback with
  the signed OCA PDFs attached.
- First run: `dry_run=true`. Only flip to live after Tito's "está bien".

### Phase 9 — SuperTito

Threaded into Phase 5 `/sign` route. On sign:

```ts
await supabase.from('classification_log').insert({
  client_id: oca.company_id,
  numero_parte: oca.np_code,
  fraccion_assigned: oca.fraccion_recomendada,
  supertito_agreed: correctionApplied ? false : true,
  supertito_correction: correctionApplied ? `${proposedFraccion}→${finalFraccion}` : null,
  ts: new Date().toISOString(),
})
```

Fills the `/catalogo/partes/[cveProducto]` "Revisado por Tito" badge
naturally.

### Phase 10 — test fences

New files:
- `src/app/api/oca/extract-invoice/__tests__/tenant-isolation.test.ts`
- `src/app/api/oca/classify-batch/__tests__/tenant-isolation.test.ts`
- `src/app/api/oca/[id]/sign/__tests__/cancel-window.test.ts` (uses
  vi.useFakeTimers for the 5-second countdown)
- `src/app/clasificar-producto/__tests__/role-fence.test.tsx`

The golden-fixture pipeline TODOs in
`src/lib/oca/__tests__/invoice-4526219.test.ts` land green here
(wire the mocked pipeline call through the real libraries).

### Phase 11 — ratchets + ship dry-run

- `bash scripts/gsd-verify.sh --ratchets-only` — must stay clean
  (hex 2722 baseline, fontSize 356 baseline, inline-glass 0,
  CRUZ-string 218 all at baseline).
- `npm run ship --skip-deploy` — gates 1-3 green.
- `npm run ship` — full six-gate ship AFTER Tito walks through the
  preview URL. Do NOT run the preview deploy until user signs off.

---

## Critical context for next session

1. **Parallel session thrashing.** Two other Claude sessions were
   running on `~/evco-portal` when this work started. That's why
   this work lives in an isolated worktree at `~/evco-portal-tito-oca`.
   `git worktree list` → two worktrees + one ui-backup. Keep using
   the isolated worktree; do not cd to `~/evco-portal` for this branch.

2. **`oca_database` dual schema.** The `types/supabase.ts` reflects the
   legacy pattern-cache shape (description, fraccion, use_count). The
   `20260413_oca_database.sql` migration has the richer shape
   (opinion_number, status, approved_at, pdf_url, etc.). The
   Phase 1 migration (`20260420_oca_classifier_schema.sql`) is
   additive + idempotent — works either way. **Phase 5 write code
   must query for the new columns gracefully** (use
   `supabase.from('oca_database').select(...).maybeSingle()` + defensive
   null-checks, since the types file may not reflect Phase 1's new
   columns until `npx supabase gen types typescript --linked` runs
   post-migration).

3. **The @react-pdf gradient bug.** 13 pre-existing tests fail with
   "PDFLinearGradient.stop(...) Cannot read properties of null." Do
   NOT use `<LinearGradient>` or gradient-stop SVG in the OCA PDF
   (`src/lib/oca/pdf.tsx` in Phase 7). Flat fills only.

4. **Classification_log column names.** tenant = `client_id` (not
   company_id). Timestamp = `ts` (not created_at). This is a
   learned-rule from prior work, codified in
   `.claude/memory/learned-rules.md`. Phase 3's resolver honors it;
   Phase 9 writes must too.

5. **The user redirected on language.** Plan originally said "Juan
   José style." Mid-session the user corrected: "we don't have to do
   anything juan jose style this is CRUZ/PORTAL." Verify output
   surfaces (Phase 7 PDF, Phase 8 delivery) use PORTAL-native tone
   — no email-mimicry, just formal OCA + clean Mensajería/email.

6. **Signature ceremony.** Plan defaults to typed "/s/ Renato Zapata
   III — Director General" line with timestamp. Phase 5.5 adds the
   one-time `/settings/signature` upload that auto-upgrades every
   subsequent PDF render. History stays immutable; only the
   presentation layer upgrades.

7. **Approval gate is HARD.** 5-second countdown before any OCA
   sign. Non-negotiable (founder-overrides.md HARD list #6).

---

## Reproducing the state

```bash
cd ~/evco-portal-tito-oca
git log --oneline -6          # expect 5 feat(oca) commits + the parent fix
npx tsc --noEmit              # EXIT 0
npx vitest run src/lib/oca    # 45/45 passing + 5 todo
```

---

*HANDOFF authored 2026-04-20 by Claude Opus 4.7 autonomous session.
Next session picks up at Phase 5 (API routes) in this same worktree.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*
