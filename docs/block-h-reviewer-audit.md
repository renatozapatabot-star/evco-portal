# Block H — The Reviewer Audit

## Thesis
**CRUZ exists to turn customs work from doing into reviewing. 99% automated, 1% one-touch approval throughout the whole flow.**

## Score Distribution

| Category | Count | Percentage |
|----------|-------|------------|
| TRUE REVIEWER (9-10) | 4 | 5% |
| Proposal-based (7-8) | 12 | 15% |
| Mixed doer/reviewer (4-6) | 45 | 56% |
| Pure DOER (0-3) | 19 | 24% |

**Weighted average: 4.2/10**

## The 4 True Reviewer Surfaces (Score 9+)
1. `/drafts/[id]` — Pedimento draft approval (approve/reject/correct with reasoning)
2. `/clasificar` — Classification voting (CRUZ suggests fracción, operator confirms)
3. `/simulador` — Tariff simulation (CRUZ computes, user validates)
4. `/launchpad` — Borrador + clasificación panels (pre-decided actions)

## Top 10 Smallest-Change-Biggest-Impact Fixes

1. **Traficos list** (4→8) — Add inline "Listo para despachar · 87% confianza · [Aprobar]" on qualifying traficos
2. **Traficos detail** (5→9) — Add "Recomendación CRUZ" section with confidence + approve/review/skip buttons
3. **Entradas list** (3→7) — Show "CRUZ: falta asignar a tráfico · [Asignar sugerido]" on unmatched entradas
4. **Expedientes** (4→8) — Show "3 docs faltantes · CRUZ ya los solicitó · [Confirmar envío]" per trafico
5. **Admin escalations** (7→9) — Add reasoning trace + one-tap "Aprobar" directly on the card
6. **Operator MI TURNO** (8→9) — Show WHY this is the next item (reasoning bullets) + one-tap complete
7. **Blocked panel** (6→8) — Show "CRUZ ya envió recordatorio hace 2h · [Escalar] [Esperar]"
8. **Financial panel** (4→7) — Show "Cartera de 60+ días creciendo · CRUZ recomienda llamar a [cliente]"
9. **Bridge card** (5→8) — Show "Puente recomendado: Colombia (18 min) · [Confirmar ruta]"
10. **CRUZ AI chat** (6→9) — Pre-populate with "Estas son tus 3 preguntas más probables" based on context

## The Single Pattern That Fixes 40 Surfaces

A **CRUZ Recommendation micro-component** — 3 lines added to any card/row:

```
┌─ CRUZ RECOMIENDA ─────────────────────┐
│ [One sentence: what to do]            │
│ Confianza: 87% · [Aprobar] [Revisar]  │
└───────────────────────────────────────┘
```

This pattern, applied to traficos list rows, entradas rows, expediente rows, blocked cards, and financial cards, would move ~40 surfaces from 4-5 to 8-9.

## Overall Rating
**CRUZ as a reviewer platform: 4.2/10**

The architecture is 9.75/10 — the data, the intelligence tables, the agent decisions, the workflow events are all there. But the UI presents this data as READ-ONLY dashboards, not as PROPOSALS requiring human approval. The gap is not data or intelligence — it's the absence of the "Aprobar / Rechazar / Corregir" pattern on 76 of 80 surfaces.

## What 10/10 Looks Like

Every surface has:
1. **A CRUZ proposal** — what CRUZ thinks should happen next
2. **Confidence** — how sure CRUZ is (shown as %)
3. **Reasoning** — why CRUZ thinks this (1-2 bullet points)
4. **One-tap action** — Aprobar (gold) / Rechazar (red) / Corregir (outline)
5. **Memory** — if the user corrected before, show "Aplicando tu regla"

The user opens CRUZ. Every card has a gold "Aprobar" button. They tap through 10 approvals in 30 seconds. Work that took 2 hours is now 2 minutes of reviewing.
