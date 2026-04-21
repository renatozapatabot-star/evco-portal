# Sunday Marathon · Phase 1 Summary — Leak Reproduction

**Date:** 2026-04-19
**Branch:** sunday/data-trust-v1
**Reports (outside repo, in /tmp):**
- `/tmp/data-trust-reports/01-leak-reproduction.md` — bug reproduction + canonical test battery
- `/tmp/data-trust-reports/02-leak-provenance.md` — who wrote the vulnerable code & when
- `/tmp/data-trust-reports/03-leak-vectors.md` — exhaustive scoping matrix of every AI tool + endpoint

## Verdict

**1 P0 leak confirmed by direct file read.**

### P0 — `execQueryCatalogo` missing allowlist filter

- **File:** `src/lib/aguila/tools.ts:234–267`
- **Problem:** queries `globalpc_productos` with `.eq('company_id', scope.companyId)` only — missing the `.in('cve_producto', activeCvesArray(await getActiveCveProductos(…)))` guard that `.claude/rules/tenant-isolation.md` mandates for catalog-style queries.
- **Consequence:** any EVCO-session question that triggers `query_catalogo` (parts, fracciones, catalog) aggregates over 149,710 rows rather than the 693 `anexo24_partidas`-verified rows. Contaminated rows (pre-Block-EE residue or rows retag didn't touch) can surface to the client via AI response.
- **Why Block EE missed it:** `src/lib/aguila/tools.ts` was written during the 2026-04-16 Sunday Marathon before Block EE codified the read-time allowlist contract on 2026-04-17. Block EE hardened write paths and fixed the visible catalog surfaces (`/api/search`, `/api/catalogo/partes`, `src/lib/catalogo/products.ts`) but did not sweep the AI tools file.

### P1 — admin/broker path has no tenant filter

- **File:** same line 244
- **Problem:** filter only applies when `!scope.allClients && scope.companyId` — admin/broker with a mistyped `clientFilter` could end up with `allClients` mis-inferred and get a cross-tenant result
- **Severity:** not a client-session leak; systemic hygiene concern

## Scoping matrix — 5 of 6 AI tools are clean

| Tool | Table | Verdict |
|---|---|---|
| `query_traficos` | traficos | CLEAN |
| `query_pedimentos` | pedimentos | CLEAN |
| **`query_catalogo`** | **globalpc_productos** | **P0** |
| `query_financiero` | econta_facturas | CLEAN |
| `query_expedientes` | expediente_documentos | CLEAN |
| `route_mention` | (config) | CLEAN |

## Proposed Phase 7 fix (one file, surgical)

Apply to `src/lib/aguila/tools.ts:238–244` the same pattern used in `src/app/api/search/route.ts:166–178`:

```ts
if (!scope.allClients && scope.companyId) {
  const activeList = activeCvesArray(
    await getActiveCveProductos(supabaseAdmin, scope.companyId)
  )
  if (activeList.length === 0) {
    return { scope: scope.companyId, topFracciones: [], tmecSavingsYtd: null,
             note: 'Sin partes verificadas en anexo 24 · catálogo no disponible todavía.' }
  }
  q = q.eq('company_id', scope.companyId).in('cve_producto', activeList)
}
```

Plus: separate admin/broker authorization path from the companyId scoping so `allClients=true` requires an explicit role assertion, not just an absence of the flag.

## Reproduction status

Static (read the source). Dynamic reproduction requires EVCO session credentials — deferred to Phase 10 re-verification.

## Next phase

Phase 2 — Schema archaeology. Full Supabase inventory + migration archaeology + table usage map.
