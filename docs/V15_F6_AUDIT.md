# V1.5 F6 — Eagle View (Audit)

Shipped Tito's morning cockpit at `/admin/eagle`: a 6-tile silver glass grid
(3x2 desktop, single column below 900px). Tiles: tráficos by status (bar
count), AR/AP resumen (reuses F3 `computeARAging` + `computeAPAging`), top 3
dormant clients, top 5 atenciones (MVE critical + audit_suggestions if table
exists + dormant), live `/corredor` iframe spanning two columns, and team
activity feed from `workflow_events` with 30s auto-refresh. Every tile is an
action. Numerics in JetBrains Mono via `var(--font-mono)`. Header carries
`AguilaMark` + `AguilaWordmark` + `CoordinatesBadge` + time-of-day greeting.
`/api/eagle/overview` returns the full payload with `private, max-age=30` and
emits `eagle_view_opened` via `interaction_events.payload.event` (the locked
15-entry TelemetryEvent union stays untouched). `ADMIN_NAV` gains Vista Águila
as the first admin/broker item; middleware now redirects admin/broker root
landings to `/admin/eagle`; CLAUDE.md V1 cockpit list updated.

**Deferred:** `/admin/clientes-dormidos` is not yet built (F7 owns it) — the
dormant tile links to the route and will 404 gracefully until then;
`audit_suggestions` table may not exist in the current schema and the fetch is
wrapped in try/catch to degrade silently; corridor is embedded via iframe
rather than direct import to keep Leaflet out of the Eagle bundle; actor names
on activity feed are `workflow:event_type` pairs until a proper author column
lands.

**Test delta:** 279 → 279 (no new test files; tiles are pure UI wrappers
around typed data from the existing F3 aging lib, which is already covered).
