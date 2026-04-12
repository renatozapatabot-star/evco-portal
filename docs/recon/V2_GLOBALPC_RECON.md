# V2 GlobalPC Recon — Tráfico State Machine

**Scope:** Block 1 foundation. Catalogs every lifecycle event we observed in
GlobalPC tráfico histories, maps them to portal workflow buckets, and fixes
the vocabulary used by `events_catalog`, `workflow_events.event_type`, and the
Cronología tab.

**Owner:** Renato IV
**Reviewer:** Tito (sign-off on public/private visibility + Spanish copy)
**Source data:** GlobalPC tráfico historial dumps (2024-2026) cross-referenced
with SOIA, VUCEM, and bank confirmation emails routed to Claudia + Eloisa.

---

## Why this document exists

The original `/traficos/[id]` route shipped with a state-machine-blind
Cronología: it rendered status-column changes as generic "Status changed"
cards. Real tráficos have ~40–70 lifecycle events (bank payments, COVE
handshakes, semáforo assignments, inspection outcomes, VUCEM acknowledgments,
load-order post-processing, etc.) that operators track elsewhere and
operators have to infer from the spreadsheet.

Block 1 replaces that with a **seeded vocabulary** (55 event types across
9 categories) so the Cronología can render every event with a canonical
icon, color, Spanish label, and description — and so Acciones Rápidas can
propose the next move based on the most recent event.

---

## The 55-event catalog

Seeded via `supabase/migrations/20260412_events_catalog.sql`. Counts per
category match the migration output.

### Lifecycle (11)

Core happy-path events every tráfico walks through, from warehouse receipt
to dispatch and expediente delivery.

| event_type | visibility | copy (es-MX) |
|---|---|---|
| `warehouse_entry_received` | private | Recepción en bodega |
| `trafico_created` | public | Tráfico creado |
| `initial_pedimento_data_captured` | private | Datos iniciales capturados |
| `invoices_assigned` | private | Facturas asignadas |
| `classification_sheet_generated` | private | Hoja de clasificación generada |
| `pedimento_interface_generated` | private | Interfaz de pedimento generada |
| `payment_notice_issued` | private | Aviso de pago emitido |
| `load_order_issued` | public | Orden de carga emitida |
| `merchandise_customs_cleared` | public | Mercancía despachada |
| `customs_clearance_notice_issued` | public | Aviso de despacho emitido |
| `digital_file_generated` | private | Expediente digital generado |

### Bank payments (11)

One event per Mexican bank integration plus `payment_all_banks` to mark the
point where every pedimento line is paid.

Event types: `payment_banamex`, `payment_bancomer`, `payment_banjercito`,
`payment_banorte`, `payment_bbva`, `payment_citibank`, `payment_hsbc`,
`payment_inverlat`, `payment_promex`, `payment_santander_serfin`,
`payment_all_banks`. All `private`, all `GOLD`, icon `credit-card`.

### Inspection (8)

Semáforo 1°/2° (each green/red) + reconocimiento aduanero 1°/2° (each with or
without incidents). Color is row-level, not category-level — green on
favourable outcomes, red on hits.

### Exception (4)

`embargo_initiated`, `rectification_filed`, `investigation_opened`,
`investigation_closed`. All rendered with red category color except
`investigation_closed` which resolves to green.

### Export (2)

`aes_itn_received`, `aes_direct_filed`. Mostly applies to US-outbound
shipments where AES ITN numbers are required.

### Load order (4)

`load_order_created`, `load_order_processed_v2`, `load_order_post_processed`,
`load_order_warehouse_exit`. Warehouse exit is public; the rest are
private operator events.

### VUCEM (5)

`cove_requested`, `cove_received`, `cove_u4_validated`,
`vucem_file_generated`, `vucem_acknowledgment_received`. Tracks the
electronic value voucher handshake end-to-end.

### Document (6)

`documents_received`, `documents_verified`, `documents_sent_to_client`,
`document_missing_flagged`, `supplier_solicitation_sent`,
`supplier_solicitation_received`. Backbone for Tab 1 (Documentos) and for
the supplier loop (Block 6).

### Manual / operator (4)

`operator_note_added`, `operator_assigned`, `operator_handoff`,
`operator_escalation`. Rendered with `TEXT_MUTED` so human-emitted events
read differently from system-emitted ones.

**Total: 11 + 11 + 8 + 4 + 2 + 4 + 5 + 6 + 4 = 55 rows.**

---

## Category → workflow bucket mapping

`workflow_events.workflow` keeps its existing 7-bucket CHECK constraint
(`pedimento | invoice | crossing | docs | intake | email | monitor`).
Block 1 does not alter it. Instead, `src/lib/events-catalog.ts` exports
`CATEGORY_TO_WORKFLOW` so any server action that fires a workflow_events
row maps its event's category to the correct bucket.

| category | workflow bucket | why |
|---|---|---|
| lifecycle | `pedimento` | core pedimento lifecycle |
| payment | `invoice` | bank confirmations reconcile against invoices |
| inspection | `crossing` | semáforo + reconocimiento happen at the bridge |
| exception | `pedimento` | embargos and rectifications belong to the pedimento chain |
| export | `pedimento` | AES is pedimento-adjacent |
| load_order | `crossing` | warehouse exit + load order are crossing events |
| vucem | `pedimento` | COVE validation gates pedimento submission |
| document | `docs` | expediente movement |
| manual | `intake` | human-driven events route to the intake workflow |

The compounding effect: existing `workflow-processor.js` consumers continue
to see familiar bucket names while the catalog adds richness at the
`event_type` level.

---

## Visibility convention

- `public` events appear on operator + client-facing views (tráfico detail,
  client cockpit, client email digests).
- `private` events are operator-internal. They still render in Cronología
  for operators but are filtered out of anything a client can see.

Bank payments are all private by design — we never expose which bank handled
which pedimento line to the client side. Cross-client leak risk if this
boundary is violated.

---

## Color + icon conventions

Row-level `color_token` values resolve through
`resolveEventColor()` in `src/lib/events-catalog.ts` to the design-system
tokens (`ACCENT_CYAN`, `GOLD`, `GREEN`, `RED`, `TEXT_MUTED`). No new hex
introduced by this block.

| intent | token | typical events |
|---|---|---|
| system intelligence / progress | `ACCENT_CYAN` | most lifecycle + vucem + export |
| money | `GOLD` | all `payment_*`, `payment_notice_issued`, `rectification_filed` |
| success / favourable | `GREEN` | cleared, recognitions without incidents, semáforo verde |
| hit / urgent | `RED` | semáforo rojo, embargos, investigation opened, incidents |
| human-emitted | `TEXT_MUTED` | `operator_note_added` |

Icons are `lucide-react` names stored as strings; the tab renderer resolves
them client-side. No icon component references in server code.

---

## State transitions — input to Acciones Rápidas

`getSuggestedActions(currentState)` in `src/lib/events-catalog.ts` encodes
25 transitions (the happy path plus common off-ramps). Key flows:

```
trafico_created
  └─ initial_pedimento_data_captured
       └─ invoices_assigned
            └─ classification_sheet_generated
                 └─ pedimento_interface_generated
                      └─ payment_notice_issued
                           └─ payment_all_banks  ─── cove_u4_validated
                                                      └─ load_order_issued
                                                           └─ load_order_warehouse_exit
                                                                └─ merchandise_customs_cleared
                                                                     └─ digital_file_generated
                                                                          └─ documents_sent_to_client
```

Off-ramps: any red semáforo, reconocimiento with incidents, embargo, or
investigation suggests `escalate` + `file_rectification` as the next move.
Document-flagged states suggest `request_docs`. Empty state (no events yet)
suggests `mark_received`, `capture_initial`, `assign_operator`,
`request_docs`, `add_note`.

The full transition table is the source of truth — this doc is illustrative.

---

## Open questions

1. **`users` table.** Mention autocomplete + operator assignment currently
   read from `client_users.role IN ('operator','admin','broker')`. A dedicated
   internal roster table would remove the role-overloading. Deferred follow-up.
2. **`events_catalog` seeding in production.** Migration is idempotent
   (`ON CONFLICT (event_type) DO NOTHING`) but requires `npx supabase db push`.
3. **Historic backfill.** Existing tráficos have no `workflow_events` rows.
   Option A: backfill via a one-shot script that reads GlobalPC history.
   Option B: only new tráficos get full state-machine telemetry, legacy
   tráficos show "Sin eventos registrados" in Cronología and rely on the
   raw status column. Decision deferred; Block 1 ships Option B.
4. **Bank-payment chooser UX.** `ACTION_RECORD_PAYMENT` has `event_type: null`
   because bank is chosen at click time. UI lands in Commit B.
5. **Empty-state "next expected" hint.** Uses `getSuggestedActions()` to pick
   the first suggested action's label. Verify the copy reads well on a fresh
   tráfico with no events.
6. **Total-duration counter.** First-to-last-event delta. Matches GlobalPC's
   tráfico-open-duration display convention (days + hours + minutes).

---

## Follow-ups

- Publish the 55-event vocabulary in a public Intelligence Product doc once
  Tito has reviewed the Spanish copy.
- Wire real ingestion (bank webhooks, VUCEM RSS, CBP semáforo polling) into
  `workflow_events` so Cronología lights up with real events on live
  tráficos — Block 1 only establishes the schema + UI chrome.
- Event drawer v2: full payload inspector + event-scoped comments.
- Delete `/traficos/[id]/legacy` after 2 weeks of operator acceptance.

---

*Recon compiled April 2026. Patente 3596. Renato Zapata & Company.*
