# Block 11 · PECE Payment Workflow + 87-Bank Catalog

## Scope shipped
- Migration `supabase/migrations/20260421_mexican_banks_pece.sql` — creates
  `mexican_banks` catalog (87 rows, Banxico codes) + `pece_payments` lifecycle
  table. Idempotent. RLS + service_role policies on both; read-all-authenticated
  SELECT policy on `mexican_banks`. Events `pece_payment_intent` and
  `pece_payment_confirmed` inserted into `events_catalog`.
- `src/lib/mexican-banks.ts` — inline catalog mirror + `filterBanks`
  (code-prefix OR normalized-name substring, diacritic-insensitive) +
  `getBankByCode`. <100ms perf path (O(n) over ~87 rows).
- `src/components/banks/BankSelector.tsx` — searchable dropdown with keyboard
  nav (↑↓ Enter Esc), 60px trigger, mono on bank_code, onlyPece filter,
  outside-click close, result counter.
- `src/lib/pece-payments.ts` — pure state machine
  (`transitionPecePayment`), Zod schemas (`CreatePeceIntentSchema`,
  `ConfirmPecePaymentSchema`), event-type mapper.
- API:
  - `POST /api/pece/create-intent` — session verify, pedimento ownership
    check, bank FK validate, insert row with `status='intent'`, fire
    `pece_payment_intent` workflow_event, log to `operational_decisions`.
  - `POST /api/pece/confirm` — state-machine transitions
    (intent→submitted→confirmed, intent|submitted→rejected), fires
    `pece_payment_confirmed` on final confirmation + decision log.
- `src/app/traficos/[id]/pedimento/pago-pece/page.tsx` + `PagoPeceClient.tsx`
  — server component with session/tenant verify, existing-payment lookup;
  client walks the three screens: intent form → submitted message + folio
  input → confirmed summary.
- `src/components/pedimento/RepeatingRows.tsx` — new `variant: 'bank'`
  renders `<BankSelector onlyPece />`. `PagosVirtualesTab.tsx` migrates
  `bank_code` from free text to the selector.
- `src/lib/__tests__/pece-payments.test.ts` — 5 tests covering catalog size,
  name/code filter + diacritic tolerance, full state transition chain,
  cronología event mapping, invalid-amount/bank/reference rejection.

## Gates
- `npm run typecheck` → clean
- `npm run build` → succeeded; routes `/api/pece/create-intent`,
  `/api/pece/confirm`, `/traficos/[id]/pedimento/pago-pece` all registered
- `npm run test` → 201 passed (previous baseline 196, +5)

## Bank count
- 87 banks seeded (plan target ≥75, commit message reflects headline 75).
  All rows carry `bank_code` + `name`; SWIFT codes populated where known.

## Keyboard nav
- Selector opens focus to search input. Arrow up/down moves the highlighted
  row; Enter selects; Escape closes. Mouse hover syncs the highlight so
  keyboard and pointer stay consistent.

## Telemetry / Cronología
- `pece_payment_intent` fired on insert (from `create-intent` route).
- `pece_payment_confirmed` fired on final confirmation transition only
  (from `confirm` route). Intermediate `intent → submitted` does NOT fire
  an event (unit-tested in `eventTypeForTransition`).
- Both route through `workflow_events` with `workflow: 'pedimento'`.
  TelemetryEvent union untouched.

## Prompt-injection attempts observed
- None during this slice.

## Deferred
- Bank API auto-submission (Block 11 V2).
- Catalog UI for maintaining `mexican_banks` rows (out of scope).

## Ready for Block 12?
- Yes. `feature/v6-phase0-phase1` clean after this commit. Tests 201, build
  green. Carriers master catalog is the next slice.
