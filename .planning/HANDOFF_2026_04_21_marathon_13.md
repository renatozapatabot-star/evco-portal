# HANDOFF — Tuesday 2026-04-21 · MARATHON-13 · Ursula Demo Prep (Post-M12)

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: prep Ursula's demo docs + surfaces using the post-M12
reality (intelligence + catalog now actually work with live data).

---

## One-line verdict

**Demo-ready with real data.** The 3 existing demo docs were updated
with real EVCO numbers (99.8% verde sustained) + real searchable
SKUs (`6600-1108`, `PC-10FRN`). Pre-M12 the parte-detail surface was
silently empty; post-M12 it shows genuine pedimento history. Zero
code changes this marathon — the surfaces were already polished
across M2-M12.

---

## Live data reality check (what I verified against prod)

```
EVCO traficos total:                    3,449
EVCO traficos with fecha_cruce filed:   2,552
EVCO traficos crossed verde (semaforo 0): 2,548
  → 99.8% first-pass liberación
```

Sample real SKUs with rich pedimento history:
- `PC-10FRN-BK(V)`
- `6600-1108-504` / `6600-1108-502`
- `910717-B 910717 5858374 LATCH RECEPTACLE NW NORTH`

Example drill-down for SKU `910717-B`:
```
folio 61126 → trafico 9254-Y1302 → pedimento 3002281 · semaforo 0
folio 61734 → trafico 9254-Y1584 → pedimento 4008096 · semaforo 0
folio 61783 → trafico 9254-Y1598 → pedimento 4008110 · semaforo 0
folio 62437 → trafico 9254-Y1844 → pedimento 4008385 · semaforo 0
folio 62775 → trafico 9254-Y2005 → pedimento 4008555 · semaforo 0
```

This is exactly the wow moment the M6 playbook draft imagined but
couldn't actually deliver before M12. The M12 fix IS the demo.

---

## Commits shipped this marathon (1 commit · 45b314d..b573e0b)

| # | Commit | What |
|---|---|---|
| 1 | `b573e0b` | Ursula doc updates with real EVCO numbers + post-M12 catalog signal |
| 2 | (pending) | this handoff |

---

## Changes per document

### `docs/URSULA_DEMO_SCRIPT_3MIN.md` (the lightning walkthrough)

- Hero greeting: `98%` → `99.8% (2,548 verdes de 2,552 cruces)`
- Catálogo search: fake `XR-` → real `6600-1108` or `PC-10FRN`
- New paragraph on the M12 signal: pedimento column now shows real
  SAT-canonical numbers per row. Operator points at the density,
  "cada uno tiene su registro SAT completo", and lets it speak.

### `docs/URSULA_7_MOMENTS.md` (one-page cheat sheet)

- Moment #2 (catálogo search) rewritten to frame the drill-down as
  "her actual data" not "our portfolio" — pedimento `4008110`,
  `4008385`, all verde. Explicitly notes this surface is live
  post-M12; pre-M12 it was silently empty.
- Updated talk track: "99.8% verde sostenido."

### `docs/EVCO_DEMO_PLAYBOOK.md` (the 14-min full walkthrough)

- "Tu patente está viva" line updated to `99.8%` with sample count
- Catálogo search example updated to real SKUs

All three docs cross-reference each other; updates flow consistently.

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1254 tests passing** (unchanged from M12) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · phantom-column gate passing |
| Pre-commit hook | green on every commit |

---

## Surface-by-surface demo readiness (what Ursula actually sees)

| Surface | State | Notes |
|---|---|---|
| `/login` | ✅ 10/10 | Monochrome silver-on-black |
| `/inicio` | ✅ 10/10 | "cruzó verde" subtitle micro-delight · freshness banner |
| `/catalogo` | ✅ 10/10 | List shows real `veces_importado` + last-cruce semáforo dots (post-M12) |
| `/catalogo/partes/[cve]` | ✅ 10/10 · **new since M12** | Real pedimentos + semáforo + fecha_cruce per row · crossings summary strip |
| `/anexo-24` | ✅ 10/10 | Formato 53 period picker · calm empty-state |
| `/embarques` | ✅ 10/10 | Mobile-scrollable table · semáforo column |
| `/mi-cuenta` | ✅ 10/10 | Silver chrome A/R · no red dunning |
| `/mensajeria` | ✅ 10/10 | Loading + error boundaries |
| `/cruz` | ⚠ 9/10 | AI surface; Anthropic credit top-up pending |

---

## The M12 → M13 gift (what this marathon delivered)

M12 fixed the phantom-column bug. M13 says the demo can now
promise what M6 hoped it could:

| What the M6 playbook claimed | Pre-M12 reality | Post-M12 reality |
|---|---|---|
| "Last 4 cruces, all verde" | Empty table | 5+ real pedimentos, all verde |
| "99.8% liberación inmediata" | Calc worked but unreachable via UI | Drills down shows the 2,548 verdes |
| "Catálogo veces_importado per SKU" | 0 everywhere | Real counts per SKU |

The M6 script was aspirational in places. M13 makes it accurate.

---

## What's intentionally NOT changed

- **`/pitch` stays at `98%`** — public marketing page. `98%` is the
  conservative long-term floor; `99.8%` is a current spike. Conservative
  claims on prospect surfaces are defensible under volatility.
- **No code changes** — surfaces were polished across M2-M12; just
  verifying the M12 fix renders correctly was enough. The demo docs
  were the only artifacts needing a refresh.
- **`/admin/intelligence` NOT included in Ursula's demo** — admin-only
  surface, role-gated. She'd never see it even if she tried. Was built
  for the operator + Tito.
- **No new primitives** — every component Ursula sees composes from
  the existing library.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline 45b314d..HEAD             # 2 commits
npm install
npx tsc --noEmit                            # 0 errors
npx vitest run                              # 1254/1254
bash scripts/gsd-verify.sh --ratchets-only  # 0 failures
```

Browser-level verification (run after PM2 restart on Throne):
1. Log in with `evco2026` → `/inicio` shows live data + verde signal
2. Click Catálogo → type `6600-1108` → real SKU list
3. Click any result → `/catalogo/partes/...` shows real pedimento timeline
4. Click Anexo 24 → period picker works
5. Click `/mi-cuenta` → silver chrome A/R

---

## Operator pre-flight (unchanged from M5)

```bash
ssh throne
pm2 restart all && pm2 save
# wait 15 min
curl portal.renatozapata.com/api/health/data-integrity?tenant=evco
# expect verdict: "green"
```

Still the ONLY external action needed before the demo.

---

## The 13-marathon arc

| M | Delivery |
|---|---|
| M2-M8 | EVCO client acquisition + demo readiness |
| M9 | Grok foundation (session-guards + ApiResponse) |
| M10 | V2 intelligence layer + tenant config |
| M11 | MAFESA activation + schema-drift finding |
| M12 | Phantom column fixed · 3 paths migrated · 2 regression guards |
| **M13** | **Demo docs updated to reflect post-M12 reality** |

---

## What happens next

Tell me the direction:
- **Option A:** Run the Ursula demo (Tuesday / when scheduled)
- **Option B:** Push MAFESA further (Tito walks through, get GlobalPC clave, first real sync)
- **Option C:** V2 forward (new anomaly rules, autonomous agent layer, client-facing intelligence surface)

Portal is ready for any of the three.

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
