# Case Study Template — One-Page Client Story

**Purpose:** A reusable one-page case study that converts specific
client outcomes into a credibility asset. Drop each new client into
the same structure; share at the end of cold-email sequences, in
LinkedIn posts, or as a "see what this looks like" moment during
negotiation.

**Length target:** One printed page, ~400 words. If it exceeds one
page, the prospect skims. If it's under 200 words, it reads thin.

**Distribution:**
- `.planning/case-studies/[client-slug].md` (source of truth)
- `/pitch/case-studies/[client-slug]` — **future route** (Phase 2)
- PDF export via React-PDF (mimic `/api/pitch-pdf` pattern; Phase 2)
- Paste as Mensajería message during the `negotiating` stage

**Voice:** Third-person journalism, not marketing. "EVCO needed X.
They got Y." Never "We unlocked value." Never "We delivered a
solution."

**Numbers discipline:** Every metric is real, auditable, and traceable
to a Supabase query or a dated event. Ship exact numbers, not
rounded ones ("22 min → 2 min" beats "10× faster"). No made-up
percentages.

**Approval gate:** Every case study requires the client's explicit
sign-off BEFORE publishing. Send them the draft via Mensajería with
subject "¿Podemos compartir esto?" and wait for a written yes.

---

## The template (copy, fill in, ship)

```
# [CLIENT NAME] · [INDUSTRY]
[SUB-TITLE: ONE-LINE SUMMARY OF WHAT CHANGED]

[IF APPROVED BY CLIENT] Published [DATE] with permission from
[CLIENT APPROVAL CONTACT NAME + ROLE].

---

## The company

[1-paragraph profile: who they are, how big, what they import, their
role in their supply chain. Specific is credible: "150-employee
plastics compounder in Ramos Arizpe, cruza 40-60 trailers/mes a
través de Nuevo Laredo" beats "a mid-sized Mexican manufacturer"]

## The situation before PORTAL

[1 paragraph describing the pain, specifically. Who was doing what
manually, how long it took, what failed when it went wrong. Quote
the client if you can: "Abríamos el Excel a las 10 PM y lo último
que veía antes de dormir era si faltaba algún certificado."]

Key numbers before:
- [Metric 1 with exact number and unit]
- [Metric 2]
- [Metric 3]

## The change

[1-2 sentences about how PORTAL slotted in. Not a feature list — a
scene. "En mayo 2026 conectamos su GlobalPC al portal; la primera
semana fue paralela (viejo flujo + nuevo flujo), la segunda semana
fue solo portal."]

## The situation after PORTAL

[1 paragraph describing the new state. Specific wins. Client quote
if you have one: "Ahora abro el portal a las 11 PM y todo está ahí.
Cerré de ver el Excel en junio."]

Key numbers after (same metrics, same unit):
- [Metric 1 with exact number — show the delta]
- [Metric 2]
- [Metric 3]

## Why it worked

[2-3 bullets — each one specific, actionable, teachable. These are
what a future prospect will repeat in a board meeting to justify
moving forward. Don't tell them "we're the best" — tell them
"conectamos con GlobalPC en 48 horas sin tocar su flujo de trabajo"
or "la clasificación pasó de manual a revisión-solamente, 90% del
catálogo se procesa solo".]

## Who to ask

[NAME, ROLE, COMPANY]
[email or LinkedIn, with explicit "public reference" consent noted]

---

Patente 3596 · Aduana 240 · Laredo, TX · Est. 1941
```

---

## Fully-worked example: EVCO Plastics

**Status:** Awaiting Ursula + Tito approval for public use.
Internal-only until approved.

```
# EVCO Plastics de México · Plásticos técnicos
De 22 minutos a 2 minutos por SKU · 98% liberación inmediata sostenida

[PENDING CLIENT APPROVAL — DO NOT PUBLISH]

---

## The company

EVCO Plastics de México es el brazo mexicano de EVCO Plastics (DeForest,
Wisconsin), un fabricante de plásticos técnicos con 148,537 SKUs activos
en su catálogo. Operan en Nuevo Laredo con la clave de cliente 9254.
Cruzan 40–60 trailers por mes a través de la Aduana 240. Su contacto
principal con Renato Zapata & Company es Ursula Banda, Directora de
Operaciones.

## The situation before PORTAL

Antes de abril de 2026, cada clasificación arancelaria nueva era un
proceso manual de 22 minutos: Ursula mandaba el Excel por WhatsApp,
el clasificador abría cada fila a mano, buscaba en el CAAAREM,
verificaba en el DOF, redactaba el fundamento legal en Word, generaba
el PDF y firmaba. A las 11 PM, Ursula abría un sistema separado para
verificar que todo estuviera listo para el cruce de las 6 AM.

Key numbers before:
- 22 minutos promedio por clasificación nueva
- 40–60 minutos para confirmar estado completo de un trafico
- 5 sistemas separados (Excel, WhatsApp, email, GlobalPC, Word)
- 2–3 viajes a la oficina del clasificador por semana

## The change

En enero de 2026 conectamos GlobalPC al portal nuevo vía el pipeline
nocturno. En febrero clasificamos los 148K SKUs históricos con AI en
local (Ollama + Qwen). En marzo migramos el flujo de clasificación
nueva al portal — la primera semana fue paralela, la segunda semana
fue solo portal.

## The situation after PORTAL

Hoy Ursula abre su teléfono a las 11 PM, ve los traficos activos
con semáforo, el estado de documentación, los próximos cruces y las
clasificaciones pendientes. Cierra el teléfono y duerme. El
clasificador ya no procesa 22 minutos por SKU — revisa sugerencias
del AI, corrige 1 de cada 10, firma, y queda trazable.

Key numbers after:
- 2 minutos promedio por clasificación nueva (10× mejora)
- Sub-3 segundos para confirmar estado completo de un trafico
- 1 sistema (el portal) con respaldo en GlobalPC
- 0 viajes a la oficina del clasificador (revisiones en portal)

Resultado sostenido últimos 90 días: 98% de liberación inmediata
(semáforo verde al primer intento). Antes: 88%.

## Why it worked

- **Nosotros escribimos el código.** No es un SaaS genérico;
  cada línea se diseñó para el flujo específico de EVCO.
- **Integramos con GlobalPC sin romperlo.** El sistema de origen
  sigue siendo la verdad; el portal es el lente moderno sobre esos
  datos. Mario Ramos (soporte GlobalPC) no percibe el portal como
  competencia.
- **Aprobación humana siempre.** La AI propone, Tito firma. Patente
  3596 honrada en cada pedimento, con trazabilidad inmutable en
  audit_log.

## Who to ask

Ursula Banda — Directora de Operaciones · EVCO Plastics de México
[email TBD] · public reference pending Ursula's approval Mayo 2026

---

Patente 3596 · Aduana 240 · Laredo, TX · Est. 1941
```

---

## Client approval flow (HARD GATE — never skip)

1. Draft the case study. Fill in all numbers from actual Supabase
   queries. No estimates.
2. Send a full draft via Mensajería:

   > "Hola [NAME] — redactamos un caso de éxito para compartir con
   > otros importadores mexicanos. Adjunto el draft. Antes de
   > publicar necesito tu permiso por escrito. Cambia lo que quieras,
   > quita lo que no quieras. Si prefieres 'no publicar' está
   > perfectamente bien. — Renato"

3. Wait for "yes" in writing. Save the approval in
   `.planning/case-studies/[client-slug]-approval.txt` with the
   date + verbatim quote.
4. Only then publish.

**If a client ever says "no":** delete all drafts, move on. Don't
ask again in 3 months. A client that says no once should never see
the asset reappear.

---

## Anti-patterns (real mistakes to avoid)

| Mistake | Why it fails | Do this instead |
|---|---|---|
| "We delivered a 10× improvement" | Vague, marketing-speak | "22 minutos → 2 minutos" |
| "Transformed their customs operation" | Nobody says this in real life | "Ursula cerró de abrir el Excel en junio" |
| Hiding the client's name until the end | Reads like a gotcha | Name in the title, clearly |
| Generic industry descriptors | Low credibility | Specific: "Ramos Arizpe plastics compounder" |
| Approval presumed, not written | Legal + ethical risk | Save the written approval, dated |

---

*Codified 2026-04-21 during Marathon 3 · HIGH-ROI · future case
studies follow this template verbatim.*
