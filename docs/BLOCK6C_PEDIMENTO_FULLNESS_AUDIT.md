# Block 6c · Pedimento Fullness Audit (retroactive)

**Branch:** `feature/v6-phase0-phase1`
**Slot:** Block 8.5 (B6c debt from marathon plan)
**Date:** 2026-04-11

---

## Scope closed

1. Extended 10 pedimento tabs wired with real forms + autosave.
2. Shared `useAutosaveChildRow` hook (lib/hooks) with debounce + AbortController.
3. Shared `<RepeatingRows>` component in `components/pedimento/` — each tab
   declares `columns` + `defaultNewRow`.
4. `/api/pedimento/[id]/child` route (`add` | `update` | `delete`) sitting on
   top of the existing `addChildRow` / `updateChildRow` / `deleteChildRow`
   server actions.
5. Cronología firing:
   - `createPedimento` inserts a `workflow_events` row with
     `event_type='initial_pedimento_data_captured'`, `workflow='pedimento'`,
     only on first creation (existing pedimento short-circuits before the
     event emit).
   - `savePedimentoField` emits `event_type='pedimento_field_modified'` for
     the significant field set (`pedimento_number`, `regime_type`,
     `document_type`, `exchange_rate`, `status`) sampled through a module
     scope `Map<pedimentoId:actor, lastFiredMs>` at 5 minutes.
6. `Ver pedimento` button added to `src/app/traficos/[id]/Header.tsx` —
   silver accent, 60px touch target on desktop, links to
   `/traficos/[id]/pedimento`.
7. 15 validation tests (target 14+) in
   `src/lib/__tests__/pedimento-validation.test.ts`.

## Tabs now live

| Tab | Table | Free-text fallback? |
|---|---|---|
| Facturas / Proveedores | `pedimento_facturas` | n/a (links to `/banco-facturas`) |
| Destinatarios | `pedimento_destinatarios` | Address stored as `{full: text}` JSONB |
| Compensaciones | `pedimento_compensaciones` | — |
| Pagos Virtuales | `pedimento_pagos_virtuales` | Bank code free-text (Block 11 wires BankSelector) |
| Guías / Contenedores | `pedimento_guias` | — |
| Transportistas | `pedimento_transportistas` | Carrier name free-text (Block 12 wires CarrierSelector) |
| Candados | `pedimento_candados` | — |
| Descargas | `pedimento_descargas` | `unloaded_at` as ISO string (textual for B6c) |
| Cuentas de Garantía | `pedimento_cuentas_garantia` | — |
| Contribuciones | `pedimento_contribuciones` | Live subtotals + grand total + T-MEC credit flag in footer |

## Gate results

```
npm run typecheck — 0 errors
npm run build     — succeeds
npm run test      — 189 / 189 (174 → 189, +15)
npm run lint      — 0 new errors attributable to Block 6c files
```

## Files touched

New:
- `src/lib/hooks/useAutosaveChildRow.ts`
- `src/components/pedimento/RepeatingRows.tsx`
- `src/app/api/pedimento/[id]/child/route.ts`
- `src/lib/__tests__/pedimento-validation.test.ts`
- `docs/BLOCK6C_PEDIMENTO_FULLNESS_AUDIT.md`

Modified:
- `src/lib/hooks/useAutosaveField.ts` (removed B6c stub — real hook lives next to it)
- `src/app/actions/pedimento.ts` (Cronología emission on create + sampled significant-field event)
- `src/app/traficos/[id]/Header.tsx` (Ver pedimento button)
- All 10 `src/app/traficos/[id]/pedimento/tabs/{Candados,Compensaciones,Contribuciones,CuentasGarantia,Descargas,Destinatarios,FacturasProveedores,GuiasContenedores,PagosVirtuales,Transportistas}Tab.tsx`

## Deferred

- Invoice bank picker modal on Facturas tab — link to `/banco-facturas` surfaces
  the banked invoices today; picker modal ships with Block 11/12 wave.
- Structured address (street/city/state/zip) expansion — JSONB key `full` today;
  Block 15 client master re-models against the 12-section schema.
- Transportistas + PagosVirtuales free-text → real catalog selectors — Blocks
  11 (BankSelector, 75-bank catalog) and 12 (CarrierSelector, 200-carrier
  catalog) per marathon plan.

## Readiness for Block 9

- `/api/pedimento/[id]/child` is the new shared scaffold for child-row CRUD
  from any pedimento tab — Block 9 can rely on existing validation without
  additional hook work.
- Validation tests cover every error class Block 9 needs to block export on
  (fracción, cantidad, transportista, facturas, DTA+pago, total mismatch).
- No migration debt for Block 9 — the existing `pedimento_data` schema carried
  through unchanged. Block 9's new `pedimento_export_jobs` table is the only
  new migration needed.
