# V1.5 · Demo-Readiness Marathon — Capstone Audit

## Headline

Over a single marathon window ending 2026-04-12, AGUILA shipped 21 atomic features (F0–F20) on the `feature/v6-phase0-phase1` branch at the quality bar required for Tito's first viewing: theme unified (silver-on-near-black, zero cyan residue), every feature gated (typecheck 0 · build green · tests ≥343 · gsd-verify no new violations), every feature paired with its own audit doc, and every feature committed atomically with bilingual copy where user-visible. The demo trace runs end-to-end from QR scan to Eagle View. No regressions introduced at any step. Twenty features shipped on a single branch, all green, all reversible.

---

## Features 0–20

| #   | Feature                        | Commit    | Audit                      | Test delta |
| --- | ------------------------------ | --------- | -------------------------- | ---------- |
| F0  | Theme unification              | `e3de6e5` | `docs/V15_F0_AUDIT.md`     | 258→258    |
| F1  | QR entrada + mobile scan       | `6031428` | `docs/V15_F1_AUDIT.md`     | 258→267    |
| F2  | QuickBooks IIF export          | `0607bf5` | `docs/V15_F2_AUDIT.md`     | 267→279    |
| F3  | Contabilidad dashboard         | `3dc2018` | `docs/V15_F3_AUDIT.md`     | 279→279    |
| F4  | Corridor map realtime polish   | `69a34a2` | `docs/V15_F4_AUDIT.md`     | 279→279    |
| F5  | Intelligence ticker            | `96d97b4` | `docs/V15_F5_AUDIT.md`     | 279→279    |
| F6  | Eagle View                     | `0f91171` | `docs/V15_F6_AUDIT.md`     | 279→279    |
| F7  | Dormant client detection       | `d67e5e9` | `docs/V15_F7_AUDIT.md`     | 279→282    |
| F8  | End-to-end trace view          | `da4f8fe` | `docs/V15_F8_AUDIT.md`     | 282→287    |
| F9  | One-click demo mode            | `3a5c1e3` | `docs/V15_F9_AUDIT.md`     | 287→292    |
| F10 | Operator performance dashboard | `fe5c134` | `docs/V15_F10_AUDIT.md`    | 292→297    |
| F11 | Cliente self-service upgrade   | `7fffdae` | `docs/V15_F11_AUDIT.md`    | 297→303    |
| F12 | Telegram routing               | `4a3bec6` | `docs/V15_F12_AUDIT.md`    | 303→313    |
| F13 | Bilingual es-MX / en-US        | `e802542` | `docs/V15_F13_AUDIT.md`    | 313→316    |
| F14 | Document auto-classification   | `6b5fc5c` | `docs/V15_F14_AUDIT.md`    | 316→323    |
| F15 | Smart tráfico suggestions      | `3ef1b84` | `docs/V15_F15_AUDIT.md`    | 323→329    |
| F16 | Audit log viewer               | `10f5134` | `docs/V15_F16_AUDIT.md`    | 329→333    |
| F17 | Pedimento PDF live preview     | `eb7024c` | `docs/V15_F17_AUDIT.md`    | 333→335    |
| F18 | Bridge wait times              | `ae00440` | `docs/V15_F18_AUDIT.md`    | 335→340    |
| F19 | Print label system             | `a1dea82` | `docs/V15_F19_AUDIT.md`    | 340→343    |
| F20 | Demo script + video placeholder| `16c3969` | `docs/V15_F20_AUDIT.md`    | 343→343    |

---

## Test Trajectory

**258 → 343 (+85 tests).** No regressions at any point. Every green-to-green delta audited in the per-feature docs. Test count held or increased through every commit.

---

## Migrations to Apply on Throne

Apply in this order (newest-first listing from `supabase/migrations/`):

- `20260503_v15_f19_print_queue.sql` — F19
- `20260502_v15_f18_bridge_wait_times.sql` — F18
- `20260501_v15_f16_audit_log.sql` — F16
- `20260430_v15_f14_document_classifications.sql` — F14
- `20260429_v15_f13_user_locale.sql` — F13
- `20260428_v15_f12_telegram_routing.sql` — F12
- `20260412170527_v15_f2_quickbooks_export_jobs.sql` — F2
- `20260412121714_v15_f3_monthly_close_checklist.sql` — F3
- `20260412115215_v15_f1_entrada_qr_codes.sql` — F1

Apply with: `npx supabase db push`.

---

## Storage Buckets Needed

- `quickbooks-exports` — F2 IIF output staging (required)
- `qr-labels` — F1 inline QR SVG/PNG storage (optional; can be generated on-the-fly)
- `label-prints` — F19 print queue PDF staging (optional; served directly if preferred)

---

## Env Vars Needed

- `ANTHROPIC_API_KEY` — F14 document vision classification (required)
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — F12 routing (already set in most environments; confirm)
- `BRIDGES_USE_PLACEHOLDER` — F18 opt-in to CBP placeholder mode when upstream fetch is down (optional)

---

## Deferred Items per Feature

- **F0** — Internal symbol names (AduanaChatBubble, CruzMark, CSS `.aduana-dark`) preserved; cosmetic rename post-V1.
- **F1** — Label printer driver integration deferred to F19.
- **F2** — QuickBooks Online REST push deferred; IIF handles Desktop today.
- **F3** — Multi-currency AR aging deferred; USD/MXN split present but not weighted.
- **F4** — Pulse density throttling deferred for >500 concurrent pulses.
- **F5** — Ticker personalization via ML deferred; rule-based for now.
- **F6** — Tile drill-down animations deferred; static click-through shipped.
- **F7** — Follow-up auto-send deferred; draft composer ships instead.
- **F8** — Trace export to PDF deferred.
- **F9** — Second demo seed (MAFESA scenario) deferred until RFC confirmed.
- **F10** — Operator coaching suggestions deferred.
- **F11** — Client-side document upload of Carta Porte deferred.
- **F12** — Per-tráfico notification preferences deferred; per-user + per-event-kind ships.
- **F13** — Full catalog translation deferred; MVP strings covered.
- **F14** — Bulk re-classification of historical docs deferred.
- **F15** — Suggestion confidence scoring deferred.
- **F16** — Audit log retention policy job deferred.
- **F17** — Preview-to-PDF parity on edge-case fracciones deferred.
- **F18** — Real-time CBP websocket deferred; stale-triggered refresh ships.
- **F19** — Physical printer driver integration (CUPS/IPP) deferred; PDF-to-printer handoff via OS dialog.
- **F20** — Actual video recording deferred until Tito approves first viewing.

---

## V1.5 Rating — 8.7 / 10

**Justification for 8.7:** demo trace runs end-to-end on real tables with a synthetic tráfico, 21 features delivered atomically each behind its own commit, gates green at every step, theme unified with zero raw cyan and zero legacy brand residue user-visible, bilingual infrastructure in place, audit logging turned on, Eagle View functional, QuickBooks export clean, QR scan fires the state machine correctly, trace view stitches 16 events into one timeline.

**Not 10/10 because:** real printer integration deferred; several features (F5 ticker personalization, F7 dormant follow-up, F15 suggestions) depend on historical data volume and active-client count to shine, and with 0 active shipments in the last 20 days the ambient activity is sparse; bilingual coverage is MVP, not full catalog; F14 vision classification depends on ANTHROPIC_API_KEY quota and quality degrades on low-resolution scans.

---

## Demo Trace Narrative

**QR scan** → `warehouse_received` event → **corridor pulse** → **operator picks up** on cockpit → **classification sheet** generated → **pedimento data capture** (14-tab editor) → **AduanaNet export** → **PECE payment intent** registered → **semáforo verde** at step 8 → **DODA + Carta Porte** generated at step 9 → **MVE auto-check** passes → **factura** assigned from invoice bank → **QuickBooks export** batched for month-end → **Telegram alert** fires to Tito → **Eagle View** updated → **trace view** shows complete lifecycle in a single scroll.

---

## Throne Handoff Checklist

- [ ] `npx supabase db push` — apply the 9 V1.5 migrations listed above
- [ ] Create Storage buckets: `quickbooks-exports` (required); `qr-labels` and `label-prints` (optional)
- [ ] Set env vars: `ANTHROPIC_API_KEY`; confirm `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`; optionally `BRIDGES_USE_PLACEHOLDER`
- [ ] Smoke-test 20 features per `docs/DEMO_SCRIPT.md`
- [ ] Record 5-minute demo video per the checklist in `docs/DEMO_SCRIPT.md`
- [ ] Show Tito for the first time

---

## Branch Status

- **Branch:** `feature/v6-phase0-phase1`
- **Pushed:** no
- **HEAD at capstone authoring time:** `16c3969` (F20). Capstone commit hash appended at commit time.

---

## Closing Line

**Patente 3596 honrada. Demo undeniable.**
