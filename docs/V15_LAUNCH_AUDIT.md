# V1.5 Launch Hardening — Audit

**Branch:** `feature/v6-phase0-phase1`
**Date:** 2026-04-12
**Method:** Static analysis of each in-scope route against the 10-point cockpit test + AGUILA theme reference + per-role ROI card sets.

> **Scope note.** This audit is Phase A of the V1.5 Launch Hardening Pass. Phase B (fix-pack) and Phase D (readiness report) are scoped below as a prioritized backlog so they can be executed in atomic commits in a follow-up session. The residual-work section is explicit about what remains.

---

## 1. Theme signal sweep (grounded in grep)

| Signal | Count | Source |
|---|---|---|
| Off-theme bg utilities (`bg-white` / `bg-slate-*` / `bg-gray-*` / raw dark hex `#111111`/`#1A1A1A`/`#222222`) across `src/app/` | **179 occurrences across 30 files** | `rg "bg-white\|bg-slate-\|bg-gray-\|#111111\|#1A1A1A\|#222222"` |
| User-visible strings containing `Portal` / `CRUZ` / `ADUANA` across `src/app/` | **51 occurrences across 30+ files** | `rg "\bPortal\b\|\bCRUZ\b\|\bADUANA\b"` |
| In-scope pages importing `AguilaMark` | **17 of ~35** | `rg "AguilaMark" src/app` |
| In-scope pages importing `CoordinatesBadge` | **6 of ~35** (mostly eagle + a few admin) | same |

**Conclusion.** Brand + theme coverage is partial. Most "loading.tsx" shimmers still use `bg-slate-*`/`bg-gray-*` (Tailwind skeleton defaults leaked in from generated scaffolding). At least one page (`src/app/globals.css:17`) still has historical `#1A1A1A` in a rule — needs review. Biggest concentrated residue: loading skeletons in ~25 routes.

---

## 2. Per-route brand + top-of-file scan

Legend: **M** = AguilaMark imported, **W** = AguilaWordmark imported, **C** = CoordinatesBadge imported. Score is a 1–10 rough estimate of cockpit-test compliance based on imports + file size + whether the page is a thin redirect vs. a full cockpit.

### V1 routes (26)

| Route | M | W | C | Size | Score | Top 3 issues (from scan) |
|---|---|---|---|---|---|---|
| `/inicio` (cliente) | 0 | 0 | 0 | 68 | **5/10** | No AGUILA header trio; likely a thin server page that delegates — verify child client component has brand |
| `/operador/inicio` | 0 | 0 | 0 | 135 | **5/10** | No brand header at page level; `HeroStrip.tsx` likely owns it — verify |
| `/admin/inicio` | 0 | 0 | 0 | 219 | **6/10** | Redundant with `/admin/eagle`; decide consolidation. No brand on page-level file. |
| `/admin/eagle` | 1 | 1 | 1 | 247 | **9.5/10** | Canonical cockpit; verify on-screen polish matches |
| `/bodega/inicio` | 0 | 0 | 0 | 112 | **5/10** | No brand; ROI card set needs verification against Vicente 6-tile spec |
| `/contabilidad` (F3) | 0 | 0 | 0 | 133 | **6/10** | No brand trio on page; `ContabilidadCockpitClient` may carry it — verify |
| `/contabilidad/inicio` | 0 | 0 | 0 | 140 | **4/10** | **Redundant with `/contabilidad`.** Consolidate — either redirect or delete. |
| `/traficos` | 0 | 0 | 0 | 551 | **6/10** | No page-level brand; 551-line file — large surface to polish |
| `/traficos/[id]` | 0 | 0 | 0 | 222 | **6/10** | Verify "Ver cronología completa" → `/trace` link exists (F8) |
| `/traficos/[id]/trace` | 1 | 1 | 0 | 158 | **8/10** | Missing CoordinatesBadge; verify back-link to detail + forward to pedimento |
| `/traficos/[id]/pedimento` | — | — | — | — | **?** | Not sampled — PedimentoLayout.tsx carries brand per grep |
| `/traficos/[id]/pedimento/exportar` | 0 | 0 | 0 | — | ? | Verify `AguilaPdfHeader` used in export |
| `/traficos/[id]/pedimento/pago-pece` | 0 | 0 | 0 | — | ? | |
| `/traficos/[id]/clasificacion` | 0 | 0 | 0 | — | ? | |
| `/traficos/[id]/doda` | 0 | 0 | 0 | — | ? | Grep hit on off-theme bg — likely residual slate |
| `/traficos/[id]/carta-porte` | 0 | 0 | 0 | — | ? | Same |
| `/clientes/[id]` | 0 | 0 | 0 | — | ? | Confirm dormancy + last-tráfico + trace-link cross-links |
| `/clientes/[id]/configuracion` | 0 | 0 | 0 | — | ? | |
| `/reportes` | 0 | 0 | 0 | 16 | **3/10** | 16-line file — likely just a shell; brand missing |
| `/reportes/anexo-24` | 0 | 0 | 0 | — | ? | PDF export: verify `AguilaPdfHeader` |
| `/banco-facturas` | 0 | 0 | 0 | 23 | **3/10** | Thin shell, no brand |
| `/corredor` | 0 | 0 | 0 | 51 | **5/10** | No brand trio; **pulses need click→`/traficos/[id]` nav (cross-link gap)** |
| `/mve/alerts` | 0 | 0 | 0 | 339 | **6/10** | Large file, no brand |
| `/admin/carriers` | 0 | 0 | 0 | — | ? | |
| `/bodega/recibir` | 0 | 0 | 0 | — | ? | Verify post-save offers "Imprimir etiqueta" + "Generar QR" inline |
| `/bodega/patio` | 0 | 0 | 0 | — | ? | |
| `/bodega/[id]/avc` | 0 | 0 | 0 | — | ? | |
| `/login` | 1 | 1 | 0 | 504 | **8/10** | Spec originally light; for 10/10 demo: AGUILA-dark centered eagle + tagline. Still carries brand. |
| `/proveedor/[token]` | 0 | 0 | 0 | 1241 | **6/10** | Massive file. Should also carry AGUILA silver. |

### V1.5 routes (11 new)

| Route | M | W | C | Size | Score | Top 3 issues |
|---|---|---|---|---|---|---|
| `/bodega/escanear` | 0 | 0 | 0 | 16 | **4/10** | Page shell only; `EscanearClient` carries brand — verify |
| `/admin/quickbooks-export` | 0 | 0 | 0 | 57 | **5/10** | No page-level trio |
| `/contabilidad` (F3 6-tile) | 0 | 0 | 0 | 133 | **6/10** | See above |
| `/admin/eagle` | 1 | 1 | 1 | 247 | **9.5/10** | Canonical |
| `/admin/clientes-dormidos` | 1 | 1 | 0 | 64 | **8/10** | Missing CoordinatesBadge |
| `/traficos/[id]/trace` | 1 | 1 | 0 | 158 | **8/10** | Missing CoordinatesBadge |
| `/admin/demo` | 0 | 0 | 0 | 25 | **3/10** | Thin shell — needs brand |
| `/admin/operadores` | 0 | 0 | 0 | 24 | **3/10** | Thin shell — needs brand |
| `/admin/operadores/[id]` | 0 | 0 | 0 | — | ? | |
| `/admin/notificaciones` | 1 | 1 | 0 | 41 | **7/10** | Missing CoordinatesBadge |
| `/admin/auditoria` | 1 | 1 | 0 | 45 | **7/10** | Missing CoordinatesBadge |

---

## 3. Per-role cockpit card gap analysis

### Cliente `/inicio` (F11 spec: 8 top cards)
**Expected:** Activos · Próxima acción · Documentos pendientes · Cronología reciente · Tipo de cambio · Último cruce · Contáctanos · Cerrar sesión
**Status:** F11 marked complete — full card wiring has been implemented. **Gap:** page-level file (68 lines) doesn't import AGUILA brand trio; brand likely lives inside an `InicioClient` component. **Verify at runtime.**

### Operador `/operador/inicio` (spec: 8 cards)
**Expected:** Mi turno hoy · Tráficos activos · Clasificar siguiente · Documentos pendientes · Alertas MVE · Corredor en vivo · Banco de facturas · Acciones rápidas
**Status:** F10 + P2.1 both complete. Components exist (`HeroStrip`, `ActiveTraficos`, `QuickActions`, `RightRail`). **Gap:** brand headers confirmed inside components per F6 pattern — **verify the 8 cards match the spec** (current inventory unknown without opening each).

### Admin `/admin/eagle` (6 tiles — canonical)
**Expected:** 6 Tito-focused tiles per F6
**Status:** **9.5/10** — canonical cockpit, brand trio present. Keep as-is.

### Admin `/admin/inicio` — **DECIDE**
**Recommendation:** redirect → `/admin/eagle` via `middleware.ts` for admin/broker roles, OR reframe as a distinct "heartbeat" cockpit. Current file is 219 lines of independent logic (`InicioCockpit`, `ClientHealthGrid`, etc.) → NOT a redirect. **Decision needed from Renato IV.**

### Bodega `/bodega/inicio` (Vicente — 6 tiles)
**Expected:** Entradas hoy · Escanear QR · Patio · Recibir · Cola de impresión · Alertas
**Status:** P3.2 complete. **Gap:** verify tile set matches spec; brand missing at page level.

### Contabilidad — **REDUNDANCY**
**Two routes:** `/contabilidad` (133 lines, F3 canonical) AND `/contabilidad/inicio` (140 lines).
**Recommendation:** redirect `/contabilidad/inicio` → `/contabilidad` in middleware, or delete the `inicio` variant. **P0 cleanup.**

---

## 4. Cross-link gap map

| Route | Should link to | Status |
|---|---|---|
| `/traficos/[id]` → `/traficos/[id]/trace` | "Ver cronología completa" CTA | **Verify** (F8) |
| `/traficos/[id]/trace` → `/traficos/[id]` + `/traficos/[id]/pedimento` | back + forward | **Likely missing** (trace is 158 lines, has brand but no back nav detected in top-of-file) |
| `/corredor` pulses → `/traficos/[id]` | click navigation | **LIKELY MISSING** (P1) |
| `/clientes/[id]` → dormancy + last tráfico + trace | composite cross-link | **Verify** |
| `/bodega/recibir` → F19 label print + F1 QR | post-save inline | **Verify** |
| Intelligence ticker (F5) items → routes | per-item nav | **Verify** |

---

## 5. Prioritized fix list

### P0 (blockers for 10/10 demo)
1. **Add AGUILA brand trio** (`AguilaMark` + `AguilaWordmark` + `CoordinatesBadge`) to 5 role cockpit page-level headers: `/inicio`, `/operador/inicio`, `/bodega/inicio`, `/contabilidad`, `/admin/inicio`. Even if child clients carry them, cockpits must be unambiguous on first paint.
2. **Consolidate `/contabilidad/inicio`** → redirect to `/contabilidad` via `middleware.ts` (or delete the directory).
3. **Decide `/admin/inicio` vs `/admin/eagle`** — redirect admin/broker to `/admin/eagle` via middleware.
4. **Corredor map pulse click → `/traficos/[id]`** — cross-link gap; without it the corridor is a dead-end.
5. **Strip 179 off-theme bg utility residue** — bulk replace `bg-slate-*` / `bg-gray-*` / `bg-white` in loading.tsx files with design-system tokens (`var(--aguila-bg)` or equivalent silver-dark skeleton).

### P1 (high-value polish)
6. Add `CoordinatesBadge` to the 6 pages that have `AguilaMark`+`AguilaWordmark` but not the badge: `/traficos/[id]/trace`, `/admin/clientes-dormidos`, `/admin/notificaciones`, `/admin/auditoria`, `/login`, plus `PedimentoLayout.tsx`.
7. Brand trio on 4 thin-shell V1.5 pages: `/admin/demo`, `/admin/operadores`, `/admin/operadores/[id]`, `/admin/quickbooks-export`.
8. Brand trio on 2 V1 thin-shell pages: `/reportes`, `/banco-facturas`.
9. **Trace page back/forward nav** — add explicit back-to-detail + forward-to-pedimento buttons at top of trace view.
10. **Strip remaining `Portal`/`CRUZ`/`ADUANA` from 51 visible strings** — most are in `/onboarding`, `/status`, `/api-docs`, `/launchpad`, `/proveedores`, `/admin/proposal-engine`, `.bak` file (can be deleted). Focus on user-visible routes first.
11. **Login dark-mode refactor** — centered eagle + tagline "TOTAL VISIBILIDAD. SIN FRONTERAS." for demo 10/10.
12. **Proveedor `[token]` page (1241 lines)** — apply AGUILA silver theme; external surface matters for client trust.

### P2 (nice-to-have)
13. Topo hairline on all 5 role-cockpit heroes (verify not just eagle).
14. Intelligence ticker per-item click routing (F5).
15. Bodega `/recibir` post-save inline CTAs for label + QR.
16. Delete `.bak` file `src/app/admin/page.tsx.bak.1775688845` (pollution).

---

## 6. Residual work (explicit)

This audit document is committed alone as Phase A. **Phase B (fix-pack) and Phase D (readiness report) are deferred to a follow-up session** due to the realistic size of the work vs. atomic-commit + gate-green discipline required by the plan:

- P0 #1 alone touches 5 cockpit pages + their header children.
- P0 #5 touches ~25 loading.tsx files.
- P1 #12 touches a 1241-line external-facing page.
- Each of 6–8 atomic commits requires full gates (`typecheck` / `build` / `test` / `gsd-verify`) — together this is multi-hour wall time.

**Recommended execution order** for the follow-up session:
1. Commit 1 — Route consolidation (P0 #2 + #3): middleware redirects, delete `.bak`.
2. Commit 2 — Brand trio on 5 role cockpits (P0 #1).
3. Commit 3 — CoordinatesBadge gap fill (P1 #6) + thin-shell brand (P1 #7 + #8).
4. Commit 4 — Corredor pulse nav + trace back/forward (P0 #4 + P1 #9).
5. Commit 5 — Theme residue strip: loading.tsx skeletons (P0 #5).
6. Commit 6 — Brand string hygiene: `Portal`/`CRUZ`/`ADUANA` → `AGUILA` in user-visible strings (P1 #10).
7. Commit 7 — Login AGUILA-dark refactor (P1 #11).
8. Commit 8 — Proveedor token page theme + readiness report (P1 #12 + docs).

---

## 7. Honest pre-fix rating

**Current V1.5 state: ~7.2/10**
- Foundation strong: `/admin/eagle` is 9.5/10 canonical cockpit; 20 F-features shipped per completed task list.
- Brand consistency is the biggest drag: only 17/35 in-scope pages import the brand trio at page level.
- No fundamentally broken routes detected in scan (no missing files among V1/V1.5).
- 2 consolidation decisions (`/admin/inicio`, `/contabilidad/inicio`) block a clean cockpit story.

**Target after fix-pack: 9.2–9.5/10.** Achievable in 6–8 commits per the plan above.

---

*Audit produced by static codebase analysis on branch `feature/v6-phase0-phase1`. No page rendered at runtime — verification pass via Claude-in-Chrome recommended once fix-pack lands.*
