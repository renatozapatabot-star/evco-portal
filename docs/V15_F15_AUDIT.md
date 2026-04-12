# V1.5 F15 · Smart Tráfico Suggestions — Audit

## Scope shipped

- `src/lib/traficos/suggest.ts` — pure aggregator. For a name/clave prefix,
  matches up to 20 candidate companies, narrows to `limit` (default 5), and
  for each computes:
  - `lastTraficoAt` + `diasDesdeUltimo`
  - `avgValue` (mean of last ≤10 `globalpc_facturas.iValorComercial`),
    rounded to cents
  - `currency` — mode of `sCveMoneda` across those facturas, clamped to MXN|USD
  - `typicalSupplier` — mode of `nombre_proveedor` (fallback `sCveProveedor`)
  - `typicalFraccion` — mode of `globalpc_partidas.fraccion_arancelaria`
  - `typicalUmc` — mode of `umc` (fallback `cve_umc`)
  - `typicalOperator` — mode of `traficos.assigned_to_operator_id`, joined
    to `operators.full_name` for display
  - `traficoCountTotal` — rows returned from the bounded last-10 query
- `src/app/api/traficos/suggest/route.ts` — GET endpoint with `verifySession`,
  cliente-role company scoping, 3-char prefix minimum, `Cache-Control:
  private, max-age=15`, telemetry insert `metadata.event =
  'trafico_suggest_queried'` (best-effort, never blocks the response).
- `src/lib/traficos/__tests__/suggest.test.ts` — 6 tests: `mode`,
  `clampLimit`, prefix-under-3 guard, full-aggregate on a fixture (EVCO
  with 3 tráficos, 3 facturas, 3 partidas), empty-history fallback,
  companyId scope.

## UI wiring

**Not applied.** No new-tráfico form exists in the codebase today —
searched `src/app/traficos/**`, `src/app/traficos/nuevo`, and grepped
for "Nuevo tráfico" / "Crear tráfico" / new-tráfico intent. Creation
currently happens upstream (email-intake + GlobalPC sync). API + lib +
tests ship now; wire the silver-glass combobox to the form when it
lands in a future build.

## Deferred

- Fuzzy match on cliente name (Levenshtein / trigram) — today the match
  is ilike-prefix only.
- RFC-prefix match (typing "EVC0101" routes to EVCO by RFC).
- Pattern decay weighting — recent tráficos should weigh more than
  year-old rows; current mode is unweighted.
- Operator preference learning — today mode is raw; should consider
  operator workload + recency.
- Wire silver-glass combobox to new-tráfico form (blocked on form).

## Gates

- `npm run typecheck` — 0 errors
- `npm run build` — green, route registered at `/api/traficos/suggest`
- Tests — 329 passing (up from 323, +6 new)
- `gsd-verify.sh` — pre-existing hex-color warnings in `src/app/demo/*`
  unrelated to this feature; no new findings on F15 files.
