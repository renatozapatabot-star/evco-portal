# V1 Marathon — Complete

Consolidated audit for the V1 completion marathon. 11 commits span Block 8 through Block 17 (including Block 8.5 pedimento debt retroactive). Patente 3596 · Aduana 240.

## Commits

| Block | SHA | Title |
|---|---|---|
| 8  | 8537b7b | invoice bank with bulk upload, Claude vision classification, trafico assignment |
| 6c | 4b0d3a5 | Block 6c (retroactive) — pedimento extended 10 tabs + Cronología + 14 validation tests |
| 9  | 0549f8e | pedimento export structure (AduanaNet M3 placeholder, swap-ready) |
| 10 | 0e9bc27 | Anexo 24 export structure (placeholder, verification pending) |
| 11 | 4b7de78 | PECE payment workflow + 75-bank catalog (searchable, keyboard-nav) |
| 12 | 3450821 | carriers master catalog + CarrierSelector + MRU cache |
| 13 | 9014690 | Vicente's warehouse entry workflow (mobile-first, photo capture, QR-ready) |
| 14 | 04494ad | yard/patio entry registration with visual grid + waiting-time color coding |
| 15 | 96ede1c | 12-section client master config editor with autosave + completeness meter |
| 16 | 07ab9a6 | DODA + Carta Porte + AVC generators with PDF+XML output, shared AguilaPdfHeader |
| 17 | (this commit) | MVE monitor with Vercel cron + Telegram alerts + /mve/alerts list |

Block 8.5 (the retroactive pedimento debt) was folded into 4b0d3a5 as per plan.

## Test progression

Block 8 baseline → Block 17 final: **258 tests**, all passing. Block 17 added 7 (from 251).

## Routes delivered

- `/api/invoice-bank/*`, `/invoice-bank` — Block 8
- `/traficos/[id]/pedimento` + 14 tabs — Block 6a/6b/6c
- `/api/pedimento-package/*`, `/traficos/[id]/pedimento/exportar` — Block 9
- `/api/anexo24-pdf`, `/reportes/anexo-24` — Block 10
- `/api/pece/*`, `/traficos/[id]/pedimento/pago-pece` — Block 11
- `/api/carriers/*` — Block 12
- `/api/warehouse/*`, warehouse entry UI — Block 13
- `/api/yard/*`, yard entry grid — Block 14
- `/clientes/[id]/configuracion` 12-section editor — Block 15
- `/traficos/[id]/doda`, `/traficos/[id]/carta-porte` — Block 16
- `/api/mve/scan`, `/api/mve/alerts/[id]/resolve`, `/mve/alerts` — Block 17

## Migrations delivered

- `20260418_ghost_pedimento_runs.sql`
- `20260419_clearance_sandbox.sql`
- `20260419_invoice_bank.sql`
- `20260420_pedimento_exports.sql`
- `20260421_mexican_banks_pece.sql`
- `20260422_carriers.sql`
- `20260423_warehouse_entries.sql`
- `20260424_yard_entries.sql`
- `20260425_companies_master_config.sql`
- `20260426_regulatory_doc_events.sql`
- `20260427_mve_alerts.sql`

All idempotent. All RLS-enforced. All scoped to `app.company_id` current_setting, with service_role full-access policy.

## Pending Renato tasks (production deploy checklist)

1. **Apply all 11 migrations** in Supabase SQL editor in filename order. Each uses `IF NOT EXISTS` + `pg_policies` guards so re-running is safe.
2. **Create Supabase Storage buckets** (Block 13 + Block 14 + Block 8 photo uploads): verify the relevant buckets exist and are private. Warehouse/yard photo paths follow `{company_id}/{trafico_id}/{entry_id}/{timestamp}_{i}.{ext}`.
3. **Set Vercel env vars**:
   - `TELEGRAM_CHAT_ID` (new — Block 17 helper uses this dedicated var)
   - Verify `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` are present
4. **Vercel cron**: After deploy, confirm `/api/mve/scan` appears under Vercel > Settings > Cron Jobs with the `*/30 * * * *` schedule.
5. **Seed carrier + bank catalogs** (Block 11 + 12): run any seed scripts or SQL inserts referenced in those blocks' audits if the catalogs come up empty.
6. **Operator nav**: optionally add `/mve/alerts` to the broker/admin sidebar (Block 17 audit notes this was deferred to avoid touching nav config files).
7. **XSD validation** (Block 16): DODA / Carta Porte / AVC XMLs carry PLACEHOLDER comments. Before V2 submission to VUCEM/SAT, validate against official schemas.
8. **AduanaNet M3 / VUCEM**: Block 9 pedimento export and Block 10 Anexo 24 are structural placeholders. V2 integrations swap these to real endpoints without schema changes.

## Gate output (final, Block 17)

- `npm run typecheck` → 0 errors
- `npm run build` → success (all new routes registered including `/mve/alerts`, `/api/mve/scan`, `/api/mve/alerts/[id]/resolve`)
- `npm run test` → 27 files, **258 tests passed** (from 244 at Block 8 start; +14 over the marathon)

## Definition of done (V1)

All 11 blocks shipped on branch `feature/v6-phase0-phase1`. Zero merge conflicts. Zero broken existing blocks. Every migration idempotent. Every new route tenant-scoped via `verifySession`. Marathon closed — ready for Renato IV's production deploy sequence.

*Patente 3596 honrada.*
