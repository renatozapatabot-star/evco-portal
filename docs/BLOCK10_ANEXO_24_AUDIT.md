# Block 10 — Anexo 24 Export (Structure Only) Audit

**Status:** Shipped (placeholder). Verification against GlobalPC sample pending.
**Branch:** `feature/v6-phase0-phase1`
**Commit:** see git log for `feat(v1-completion): Block 10 — Anexo 24 export structure`

## Scope

- Pure function `src/lib/anexo-24-export.tsx` exposing
  `generateAnexo24(data): { pdf, excel }` — both return `Buffer`.
- Route `/reportes/anexo-24` — date range picker, optional cliente filter
  (broker/admin only), AMBER banner, "Generar Anexo 24" CTA.
- API `POST /api/reports/anexo-24/generate` — tenant-scoped via
  `verifySession`, builds row set from `globalpc_partidas` + `traficos`,
  uploads BOTH PDF + Excel to `anexo-24-exports` bucket, inserts
  `operational_decisions` log row with
  `decision_type='anexo_24_generated'`.
- 3 new tests in `src/lib/__tests__/anexo-24-export.test.ts`
  (Excel structure, PDF signature + size, storage path + meta round-trip).
- No migration — reuses existing storage namespace + `operational_decisions`.

## Placeholder warnings (two layers, both es-MX)

- Page banner: `Formato Anexo 24 pendiente verificación — comparar contra muestra de GlobalPC antes de uso oficial.`
- File header comment on `src/lib/anexo-24-export.tsx`: `// PLACEHOLDER Anexo 24 column structure. Verify against GlobalPC output before official use.`
- In-PDF amber banner on every page reiterates the notice.
- Excel meta block repeats the notice in row 2.

## Column set (placeholder, to be reconciled)

`consecutivo, pedimento, fecha, trafico, fraccion, descripcion, cantidad, umc, valor_usd, proveedor, pais_origen, regimen, tmec` — all labels in es-MX.

## Gates

- `npm run typecheck` — 0 errors
- `npm run build` — succeeds; both `/reportes/anexo-24` and
  `/api/reports/anexo-24/generate` appear in the route manifest
- `npm run test` — 196 pass (up from 193, Block 10 added 3)

## Shared PDF header debt

The AGUILA silver header + footer is **inline-copied** from Block 5's
`src/lib/classification-pdf.tsx`. Block 16 will extract the shared
`AguilaPdfHeader` / `AguilaPdfFooter` into `src/lib/pdf/brand.tsx`; at that
point this file will be refactored to import from the shared module. The
visual output already matches Block 5's silver palette, wordmark, and
gradient so the B16 swap is cosmetic-only.

## Blocked on Renato

- Provision `anexo-24-exports` Supabase Storage bucket (flag: same pattern as
  `pedimento-exports`, `expedientes`, etc.).

## Next

- Block 11 — PECE payment workflow + 75-bank catalog.
- Post-B16: DRY the inline AGUILA header with the shared component.
- Post-Tito: replace placeholder column set with reconciled GlobalPC-matched schema.
