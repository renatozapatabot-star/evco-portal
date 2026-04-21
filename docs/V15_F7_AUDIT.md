# V1.5 F7 — Dormant Client Detection (Audit)

Shipped `/admin/clientes-dormidos`: silver glass list of clientes with historical
tráfico activity but no motion in the last N days (threshold 7–60, default 14,
capped at 50 rows). Every row has a one-click "Generar mensaje" that opens a
silver glass modal with a Spanish follow-up message (greeting · context · value
prop · soft CTA · signed Patente 3596) and a "Copiar al portapapeles" button.
Pure logic lives in `src/lib/dormant/detect.ts` (`detectDormantClients`,
`generateFollowUpMessage`, `clampThreshold`) with three new tests. API:
`GET /api/clientes/dormidos?threshold=N` returns the list and emits
`dormant_list_viewed` via `interaction_events.payload.event` (locked telemetry
union untouched); `POST /api/clientes/dormidos/mensaje` returns a generated
message and fires a `dormant_message_generated` workflow_event. Eagle View
`/api/eagle/overview` now reuses the shared lib (single source of truth) and
its Clientes Dormidos tile link is no longer a stub. `INTERNAL_GROUPS`
Administración gains the new route for admin/broker; CLAUDE.md V1 cockpit
Cross-domain list updated.

**Deferred:** no auto-schedule + auto-send (humans still authorize every
outbound); no email integration — the modal only copies to clipboard; no
per-cliente dormancy threshold override (global threshold only); no RFC
lookup fallback when `companies.rfc` is null. Performance: per-company
N+1 last-tráfico + last-invoice queries are acceptable at ≤500 active
companies but should be promoted to a materialized view before 2K clientes.

**Test delta:** 279 → 282 (+3 new assertions covering `clampThreshold`
bounds and `generateFollowUpMessage` template / empty-name path).
