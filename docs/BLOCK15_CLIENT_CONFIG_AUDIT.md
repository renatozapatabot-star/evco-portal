# Block 15 — Client Master 12-Section Config · Audit

**Branch**: `feature/v6-phase0-phase1`
**Commit**: atomic (no A/B split — all gates green in one pass)
**Prev tests**: 217 · **New tests**: 242 (+25)

## Shipped

### Migration
- `supabase/migrations/20260425_companies_master_config.sql` — idempotent `ADD COLUMN IF NOT EXISTS` × 12 on `companies`. JSONB + one `text` column. Column comments name each section.

### Library code
- `src/lib/client-config-schema.ts` — per-section TypeScript interfaces, required-field maps, array-min-row maps, shared regexes (RFC, CP, email, patente, aduana).
- `src/lib/client-config-validation.ts` — pure `validateClientConfig(row) → ValidationError[]` + `computeCompleteness(row) → SectionCompleteness[]`. 12 per-section validators plus two cross-section rules (RFC requires a principal/facturacion contact; billing email warns if missing from notificaciones).
- `src/lib/hooks/useAutosaveJsonField.ts` — JSONB-aware autosave: 800ms debounced save, `flush()` on blur, AbortController cancel-on-change, status cycles idle → saving → saved → idle.

### API routes
- `POST /api/clientes/[id]/config/save-section` — auth via `verifySession`, role gate (broker/admin/operator), shape check per section kind (object/array/text), atomic single-column update.
- `GET /api/clientes/[id]/config/validate` — returns `{ errors, completeness }` computed against current row.

### UI
- `/clientes/[id]/configuracion` — server component reads the row, computes initial completeness + errors, renders `<ConfigEditor>`.
- `ConfigEditor` — grid layout: tab strip (12 tabs, scroll-snap on mobile) + right rail (overall % + per-tab % with click-to-navigate + missing-field count) + bottom bar "Validar configuración completa".
- 12 tab components, one per section, each wired to `useAutosaveJsonField` and sharing `FieldPrimitives` (TextField/NumberField/SelectField/TextAreaField/ActionButton/RowCard/FieldGrid).
- `SectionAutosaveBadge` inline per tab header.

### Tests — +25 in `src/lib/__tests__/client-config-validation.test.ts`
- One block per section (12 sections).
- Cross-section RFC consistency (positive + negative).
- Billing email vs email_alerts warning.
- `computeCompleteness` — fully valid row hits 100% per required section; empty row reports missing required fields.

## Gate output

```
npm run typecheck   → 0 errors
npm run test        → 23 files · 242 passed (was 217)
npm run build       → Compiled successfully
  ƒ /api/clientes/[id]/config/save-section
  ƒ /api/clientes/[id]/config/validate
  ƒ /clientes/[id]/configuracion
```

## Design compliance

- AGUILA silver palette only (`ACCENT_SILVER`, `ACCENT_SILVER_DIM`, `BORDER_SILVER rgba(192,197,206,0.22)`) — no new cyan/gold consumers.
- Glass cards: `rgba(9,9,11,0.75)` + `backdrop-filter: blur(20px)`.
- 60px min-height on every input, select, textarea, button.
- JetBrains Mono on RFC, codes (patente, aduana, CP, telegram_chat_id, folios, percentages).
- es-MX throughout.
- Empty states for each array section ("Sin … registrados.").
- Zero `any`, no `.catch(() => {})`, no `window.open`.

## Tenant safety

- Session verified on both API routes; only broker/admin/operator roles can read or write config. Clients are redirected to the detail page.
- No hardcoded `'9254'` or `'EVCO'` anywhere in new code.
- Updates scoped to `.eq('company_id', id)` — single row, no cross-tenant write possible.

## Readiness for Block 16

- Migration file format + idempotency matches prior blocks — Block 16 can keep the pattern.
- `FieldPrimitives` + `TabHeader` + `SectionAutosaveBadge` are reusable for the DODA/Carta Porte/AVC generator UIs (`/traficos/[id]/doda`, etc.).
- No shared-file debt carried forward.

## Out-of-scope (intentional)

- No changes to existing client detail page at `/clientes/[id]`.
- No nav-link addition (Block 16 or follow-up will wire a "Configuración" link).
- No realtime push — polling-free refresh on save via `refreshCounter` effect.
- Supabase types regeneration deferred (migration not yet run against remote — Tito/Renato IV to apply via SQL Editor).

## Injection attempts observed
None. All instructions came from authoritative prompt + plan file + existing repo CLAUDE.md/rules files (pre-existing project context). No third-party data was interpreted as instructions.
