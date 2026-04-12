# V1.5 · F1 — QR entrada generation + mobile scan

**Shipped.** `entrada_qr_codes` table with company_id scoping, RLS matching the
Block 13/17 `current_setting('app.company_id')` pattern, and three indexes
(trafico, company, code). `src/lib/qr/codes.ts` exposes `generateShortCode()`
(10-char base32 without confusing glyphs), `createEntradaQrCode()` (inserts
row + renders PNG data URL via the `qrcode` npm package, retries on unique
collision), `parseScanPayload()` (accepts raw code or URL form), and
`resolveEntradaQrCode()` (tenant-scoped lookup, stamps scan metadata,
emits `warehouse_entry_received` onto `workflow_events` so Block 7's
corridor-position resolver pulses `rz_warehouse` without further wiring).
`/api/supplier/confirm-shipment` now auto-generates a QR on first successful
confirm and returns the data URL; the supplier portal renders the label with
an "Imprimir etiqueta" button (uses `window.print()`). `/bodega/escanear` is a
new mobile-first client page: native `BarcodeDetector` on modern browsers,
dynamic import of `html5-qrcode` as fallback, permanent manual-entry input,
60px+ tap targets, AGUILA monochrome glass, es-MX copy throughout. POST
`/api/qr/resolve` verifies session, restricts to warehouse/operator/broker/admin,
resolves the code scoped to `companyId`, logs via `logDecision` (telemetry
event `qr_scan_resolved`), and redirects the client to
`/traficos/{traficoId}`. `WAREHOUSE_NAV` gained `/bodega/escanear`; CLAUDE.md
V1 cockpit warehouse list updated.

**Deferred.** Real print-queue integration (currently `window.print()`
triggers the browser dialog — F19's `print_queue` will supersede).
SOIA/SAT XSD validation on the emitted event (outside F1 scope). Extending
the supplier page to let the proveedor regenerate/re-download the label
after session reload (currently in-memory only; a follow-up can hydrate
from `entrada_qr_codes` on GET). Full camera-torch/autofocus controls on
fallback scanner. html5-qrcode types are shipped by the package; no
`@types/` add needed.

**Test delta.** Baseline 258 passing tests → 264 passing (+6, one new file
`src/lib/__tests__/qr-codes.test.ts` covering short-code shape + uniqueness,
scan payload parsing, create insert + PNG data URL, resolve happy path,
FORBIDDEN cross-tenant, NOT_FOUND). Typecheck, lint, build, gsd-verify all
green.

**Deps added.** `qrcode` (^1.5.4) + `@types/qrcode` (^1.5.5) + `html5-qrcode`
(^2.3.8).
