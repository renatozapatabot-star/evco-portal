# V1.5 F5 — Intelligence Ticker (Audit)

Ticker shipped as a 32px silver-hairline strip mounted in `DashboardShellClient`
above `#main-content`, visible on every authenticated route. `IntelligenceTicker`
is a pure CSS keyframe scroller (no animation library), respects
`prefers-reduced-motion`, duplicates the item list for seamless looping, and
refetches `/api/intelligence/feed` every 60 seconds. The feed is
role-personalized: admin/broker see USD/MXN + top client MoM delta + dormant
clients + MVE critical + Solidarity wait; operators see four bridge waits +
pending document solicitations + MVE critical; contabilidad sees USD/MXN + AR
overdue; bodega sees entradas 24h + yard occupancy; clients see their own
active tráficos + last crossing + USD/MXN. Telemetry logs
`intelligence_feed_fetched` to `portal_audit_log` once per fetch.

**Deferred:** real Banxico USD/MXN wire (F18), live CBP bridge wait fetch
(F18), proper dormant-client detection (F7 will enhance with activity-based
heuristics), yard occupancy denominator polish once `yard_positions` capacity
schema lands, last-QB-export status for contabilidad role.
