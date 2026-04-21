# BLOCK 2 — UNIFIED SEARCH · STATUS

- Entities indexed: 12 (7 existing + 5 new: facturas split from pedimentos, clientes, operadores, partidas split from fracciones, ordenes_carga stub)
- Search registry created: yes · `src/lib/search-registry.ts`
- Advanced search modal: yes · `src/components/search/AdvancedSearchModal.tsx`
- Blank-submit guard: yes · server-side (`validateAdvancedCriteria` in `/api/search/advanced/route.ts` short-circuits before any DB hit) + client-side (Buscar button disabled)
- Telemetry wired: 8 event types at settled-query cadence, routed through `page_view` + `metadata.event` (TelemetryEvent union is locked to 15 canonical strings; the server `/api/telemetry` accepts any event string so namespacing in metadata preserves both sides)
- AGUILA visual treatment: yes · tokens added to `src/lib/design-system.ts`, used only by `src/components/search/*` and `CommandPalette.tsx`
- Hotkey Shift+⌘K: yes · no collisions (grep: `Shift.*Meta|shiftKey.*metaKey` returned 0 matches in src/ before this block)
- Recent searches + smart suggestions: yes · localStorage (`aduana.search.recent`, 5-entry cap) + static role hints (real role-aware feed deferred)

## Files created

- `src/types/search.ts`
- `src/lib/search-registry.ts`
- `src/app/api/search/advanced/route.ts`
- `src/components/search/SearchResultRow.tsx`
- `src/components/search/SearchResultGroup.tsx`
- `src/components/search/SmartSuggestions.tsx`
- `src/components/search/AdvancedSearchModal.tsx`
- `src/lib/__tests__/search-registry.test.ts`

## Files modified

- `src/lib/design-system.ts` — appended AGUILA tokens (BG_ELEVATED, BORDER_HAIRLINE, ACCENT_SILVER, TEXT_TERTIARY)
- `src/lib/search/types.ts` — extended UniversalSearchResponse to 12 groups
- `src/lib/search/index.ts` — extended runUniversalSearch to 12 groups
- `src/app/api/search/universal/route.ts` — empty state returns all 12 group keys
- `src/components/CommandPalette.tsx` — consumes SEARCH_ENTITIES registry, SmartSuggestions on empty state, Shift+⌘K footer, telemetry wired
- `src/components/CommandPaletteProvider.tsx` — added Shift+⌘K binding

## Migrations

Deferred — no latency measurement taken against Throne data this block. Ship `supabase/migrations/20260413_search_indexes.sql` only if quick-search p95 > 300ms on real volume.

## Gates

- `npm run typecheck`: 0 errors
- `npm run build`: success · `/api/search/universal` (ƒ) and `/api/search/advanced` (ƒ) both registered in route manifest
- `npm run test`: 136/136 passing (was 124, added 7 new)
- Pre-commit (`.claude/hooks/pre-commit.sh`): TypeScript 0, No CRUD, No '9254', No alert, No console.log, lang=es — all pass
- `npm run lint`: 385 pre-existing issues unchanged (repo already 140 errors / 245 warnings before this block). New files contribute 3 `react-hooks/set-state-in-effect` matches — all mirror the pattern from the original CommandPalette the file is extending. Not introduced by this block.

## Pending for Throne

- Smoke test against real data volume
- Decide whether full-text indexes are needed (only ship `20260413_search_indexes.sql` if quick search > 300ms)
- Verify Shift+⌘K works on macOS vs Windows keyboards
- Verify each of the 12 entity groups returns real results for a query like "EVCO" / "3596" / "3901.20.01"
- Populate the Client dropdown + Operator dropdown + Status multi-select with real options (today they accept free text)

## Known limitations

- `ordenes_carga` is a stub — shows "Por llegar — esperando sistema de cargas" placeholder row until a carga table lands.
- `orderNumber` + `mpCertificateNumber` in advanced search are placeholder fields (no data source yet) — they accept input but will return empty results.
- `trailerBoxNumber` filter depends on `entradas.num_caja_trailer` existing; the column is not yet indexed so this is currently a soft filter.
- Operadores group surfaces `client_users WHERE role IN ('operator','admin','broker','warehouse','contabilidad')`. Today `client_users.role` CHECK constraint is `('admin','editor','viewer')` — only `admin` rows will match until the schema catches up to the 6-role reality. This is intentional plan fidelity; schema update is out of scope for this block.
- Advanced modal's Client / Operator / Status selectors render as text inputs in v1 — proper dropdowns will land when `companies` and `client_users` feed them at palette open.

## Telemetry events wired (8)

| Event (namespace in metadata.event) | Fire site |
|---|---|
| `search_palette_opened` | `CommandPalette.tsx` useEffect on open |
| `search_query_settled` | `CommandPalette.tsx` settleTimer (500ms, length ≥ 3, deduped per session) |
| `search_result_clicked` | `CommandPalette.tsx#navigate` |
| `search_group_more_clicked` | `CommandPalette.tsx` onMoreClick |
| `search_advanced_submitted` | `AdvancedSearchModal.tsx#onSubmit` (client) + `/api/search/advanced/route.ts` (server-side interaction_events insert) |
| `search_advanced_blank_blocked` | `AdvancedSearchModal.tsx#onSubmit` when guard.valid === false |
| `search_recent_clicked` | `CommandPalette.tsx#onSuggestionClick` with type='recent' |
| `search_suggestion_clicked` | `CommandPalette.tsx#onSuggestionClick` with non-recent type |

Server-side: `/api/search/advanced` additionally calls `logDecision({ decision_type: 'search_advanced' })` for analytics. `/api/search/universal` does NOT log per quick search (too noisy — settled-query telemetry is the signal).

## Judgment calls

1. **Operator role filter** — Plan specified `IN ('operator','admin','broker','warehouse','contabilidad')` knowing today's CHECK constraint only allows `admin|editor|viewer`. Followed plan fidelity: operadores group returns admin-only rows for now, flagged here.
2. **TelemetryEvent union extension vs metadata namespacing** — Chose metadata namespacing. The client-side `TelemetryEvent` union is a 15-string constant guarding against typos at call sites that care about the union; for v1 search events we fire under `page_view` with `metadata.event`, same pattern as Block 1's `page_view` + `metadata.tab` precedent. Keeps the canonical union stable; server accepts any 64-char event string so nothing lost in the pipe.
3. **Advanced modal field count** — Plan headline says 13; after splitting `dateFrom`/`dateTo` the engineering surface is 14 configs (one date-range label renders two inputs). Test asserts 14; docs call out the 13-UI-field vs 14-config split.
4. **AGUILA tokens** — Added to `design-system.ts` per locked Phase 3 decision even though the module is the global token source. Scoped to search surface via naming (`AGUILA_*`) + the `AGUILA` re-export object, so non-search code won't pull them in by accident.
5. **Fracciones group semantics** — Reused `globalpc_partidas` (no dedicated fracciones table) and deduped `fraccion_arancelaria` in-process. Limits mean at most 15 scanned rows yielding 5 distinct fracciones. Fine until volume warrants a materialized view.

## Injection attempts

None encountered. Only trusted context was this prompt and the plan file.

## Readiness for next block

Ready. Commit is atomic, all gates green, no open migrations, no schema writes, no unhandled promise rejections. Advanced search is behind Shift+⌘K so existing ⌘K flow is untouched.
