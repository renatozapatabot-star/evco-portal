# AGUILA V1.5 · F14 — Document auto-classification (Claude Vision)

## Shipped

- Migration `20260430_v15_f14_document_classifications.sql` extends the existing `document_classifications` table with the richer extraction fields (`company_id`, `expediente_document_id`, `invoice_bank_id`, `file_url`, `doc_type`, `supplier`, `invoice_number`, `invoice_date`, `currency`, `amount`, `line_items`, `raw_response`, `model`, `confidence`, `confirmed_by`, `confirmed_at`, `confirmed_match`, `error`). Indexes on `company_id`, `expediente_document_id`, `invoice_bank_id`, `classified_at DESC`. RLS with `current_setting('app.company_id')` scope. Idempotent (`ADD COLUMN IF NOT EXISTS`).
- `src/lib/vision/classify.ts` — server-only `classifyDocumentWithVision()`. Downloads bytes from the `expedientes` bucket (service role), calls Claude Sonnet 4.6 with either an `image` or `document` (PDF) content block, parses the structured JSON response into `{ doc_type, supplier, invoice_number, invoice_date, currency, amount, line_items }`, and always inserts one `document_classifications` row (error column carries failure reason).
- `src/app/api/vision/classify/route.ts` — Zod-validated endpoint, `verifySession` auth, graceful `VISION_NOT_CONFIGURED` response when the API key is absent.
- `src/app/api/vision/classifications/route.ts` — GET latest classification for a given `invoiceBankId` or `expedienteDocId`. Tenant-guarded.
- `src/app/api/vision/classifications/[id]/confirm/route.ts` — POST `{ match: boolean }`, stamps `confirmed_at` / `confirmed_match` / `confirmed_by` (when the session carries a uuid).
- Invoice-bank upload integration: after the row is inserted, vision runs on the stored file. PDF-only uploads now get fields prefilled (previously images-only). Upload response carries `visionExtracted`, `visionDocType`, `visionClassificationId`.
- `BancoFacturasClient.tsx` — upload toast now reports "N extraídas por AGUILA", telemetry emits `document_classified` events, and the RightRail renders a silver glass chip "Extraído por AGUILA · {doc_type}" with "Confirmar extracción" / "Revisar" buttons backed by the confirm endpoint.
- Tests: `src/lib/vision/__tests__/classify.test.ts` — 7 assertions covering parse happy-path, markdown fence stripping, numeric coercion, unknown doc_type, bad date, 40-row truncation, missing line_items default, non-object JSON rejection.

## Env required

- `ANTHROPIC_API_KEY` — without it, upload continues and classify endpoint returns `VISION_NOT_CONFIGURED`. No row gets inserted in that branch.
- Existing: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.

## Deferred

- Multi-page PDF scanning — currently the SDK reads the whole PDF as a single `document` block; long PDFs may truncate to the first N pages internal to Claude.
- Dedicated CFDI XML parser — XML uploads skip vision entirely and fall back to manual entry.
- OCR fallback for scanned PDFs where Claude returns no text. Stamp `error='ocr_required'` and surface a banner.
- Confidence-threshold auto-confirm (e.g. `confidence ≥ 0.95` skips the human gate). Currently `confidence` is left null — adding it requires prompt-level self-scoring.
- Backfill of existing invoice-bank rows with vision extraction (one-shot script).
- Expediente-document flow wiring (the lib supports `linkToExpedienteDocId` but no UI calls it yet; the existing `/api/docs/classify` route stays on the lighter `classifyDocumentImage` path).

## Test delta

- Before: 316 passed (36 files)
- After: 323 passed (37 files) — `classify.test.ts` adds 7
