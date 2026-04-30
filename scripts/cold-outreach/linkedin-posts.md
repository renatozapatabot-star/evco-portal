# LinkedIn Public Post Templates — Founder Voice

Public LinkedIn posts from **Renato Zapata IV's personal account**.
Distinct from `linkedin-dms.md` (1:1 DMs) — these are 1-to-many
broadcasts to warm up the pipeline, earn credibility, and bring
inbound leads through `/pitch`.

**Why public posts:**
- Warm the list before cold DMs land. Same prospects scrolling by
  their feed see your content twice a week; when the DM hits,
  there's recognition, not suspicion.
- Inbound > outbound. One well-crafted post → 2-3 DMs into your
  inbox from CFOs you didn't cold-email.
- Compounds. Every post is archive + portfolio. Six months from
  now prospects who just found you can scroll back and see
  "they've been building this for a while."

**Cadence:** 2 posts per week, Tuesday + Thursday 09:00–10:00 CT.
Don't post Mondays (low engagement) or weekends (noise).

**Format discipline:**
- Hook in the first 2 lines (LinkedIn collapses at ~200 chars)
- Line breaks every 1–2 sentences (mobile scannability)
- One idea per post — NEVER list 5 things
- Native text > external links (LinkedIn throttles link posts)
- Image / screenshot boosts reach 3×
- Hashtags at bottom: 3 max, relevant (#comercioexterior,
  #aduana, #CFO, #automotive, #plasticos)

**Voice rules (founder, not corporate):**
- First person singular. "Construí esto", not "Construimos"
- Specific, not abstract. "22 min → 2 min" beats "faster"
- No bullshit words: "innovador", "revolucionario", "disruption"
- Spanish primary; English for technical terms when they land
  better (e.g., "Active CPU pricing", "build log")
- Humble on claims. "Esto es lo que funcionó" > "La solución que
  necesitas"

---

## Template 1 — The Launch Post (one-time, T-0)

**Purpose:** Announce PORTAL is live. Strong opening statement.
Prospects who land here get pushed to `/pitch` directly.

```
Hace 85 años que mi familia cruza la frontera de Laredo.

Hace 3 meses decidimos rediseñar el despacho aduanal desde cero —
con IA, con código propio, con patente 3596 honrada.

Esto es lo que tenemos funcionando hoy:

→ 148,537 SKUs clasificados automáticamente (antes: 22 min por SKU)
→ Anexo 24 auditado contra el SAT en tiempo real
→ Portal del cliente: abre a las 11 PM, ve su operación, cierra, duerme
→ 98% de liberación inmediata (semáforo verde, últimos 90 días)

No es una demo. Es nuestra operación diaria con EVCO Plastics de México.

Si tienes importaciones mexicanas y estás harto de esperar 6 horas
por una clasificación arancelaria → nuestro demo público está abierto:
renato-zapata.com/pitch

Sin registro. Sin email. Zero compromiso.

— Renato Zapata IV
Patente 3596 · Aduana 240 · Laredo, TX

#ComercioExterior #Aduana #Importaciones
```

**Attach:** Screenshot of `/pitch` hero (the 22 min → 2 min delta strip).

---

## Template 2 — The Before/After Post

**Purpose:** Show concrete, measurable improvement. Build
credibility through specificity.

```
Un SKU. Una clasificación arancelaria. Antes vs hoy.

ANTES (marzo 2025):
1. Ursula manda el Excel por WhatsApp
2. Nuestro clasificador abre cada fila manualmente
3. Busca la fracción en el CAAAREM, verifica en el DOF
4. Redacta el fundamento legal en Word
5. Genera el PDF. Firma. Manda por email.

⏱ 22 minutos promedio por SKU.

HOY (abril 2026):
1. Ursula sube el Excel al portal
2. Qwen clasifica 50 SKUs en paralelo
3. Tito revisa, corrige si algo se ve raro, firma
4. El PDF se genera automáticamente
5. Todo queda en el expediente trazable

⏱ 2 minutos promedio por SKU.

10× más rápido. Misma patente 3596. Mismas reglas del SAT.

La diferencia es el código que escribimos en los últimos 6 meses —
no magia, ingeniería. Cada clasificación queda auditada en la tabla
de cambios, con el fundamento legal, la fecha y quién firmó.

Si eres director de comercio exterior y tienes 100+ SKUs que cruzar
cada semana — vale la pena 15 minutos para ver cómo lo hicimos.

renato-zapata.com/pitch

#Aduana #IA #SupplyChain
```

**Attach:** Side-by-side screenshot of the old Excel flow vs the
`/catalogo` cockpit.

---

## Template 3 — The Specific-Customer Story

**Purpose:** One concrete customer, one concrete problem, one
concrete resolution. Reads like journalism, not marketing.

```
El lunes pasado Ursula me llamó a las 11:47 PM.

"Renato, necesito que me confirmes si la fracción 3901.20.01 aplica
para el catalizador XR-847. El trailer llega al puente mañana a las
6 AM y no quiero tener que despertar a Tito."

Hace 6 meses esa llamada era una emergencia: abrir Excel, buscar en
el CAAAREM, hablar con el clasificador, escribir el fundamento.
40 minutos mínimo, a medianoche.

El lunes pasado abrí el portal, escribí "XR-847" en la barra de búsqueda,
vi la fracción confirmada con 4 referencias anteriores del mismo SKU,
la fecha del último cruce (17 de abril, también semáforo verde), y
el fundamento legal ya pre-redactado.

Le contesté en 90 segundos: "Sí, 3901.20.01. Ya está firmado.
Duerme, cruza mañana."

Ese mismo portal está abierto para demos públicas sin email ni
registro: renato-zapata.com/pitch

Es el tipo de herramienta que hace que un despacho de 85 años se
sienta como una startup.

Patente 3596 · Aduana 240 · Laredo, TX

#Aduana #LogísticaInteligente
```

**Attach:** Screenshot of `/catalogo/[cveProducto]` with the "Revisado
por Tito" badge visible (once classification_log has real data).

---

## Template 4 — The "Why we built it" Post

**Purpose:** Earn respect from other builders + attract technical
decision-makers who value engineering rigor.

```
No somos un SaaS. Somos un despacho aduanal con código propio.

Esa distinción importa. Un SaaS vende licencias. Un despacho aduanal
con código propio vende despacho aduanal — el código es la ventaja
competitiva, no el producto.

Cuando EVCO nos trae un pedimento, nuestro código:

1. Descarga del GlobalPC la información del trafico
2. Cruza con Anexo 24 en Supabase
3. Corre clasificación AI sobre cada SKU nuevo
4. Genera el documento PDF con patente 3596
5. Sube todo al portal del cliente

Todo en menos de 3 segundos.

No hay otro despacho en Laredo con esto. Lo sé porque pregunté a 40.

Lo construimos nosotros — dos personas, Next.js + Supabase + Anthropic,
Patente 3596 honrada en cada línea.

Si eres importador y quieres ver cómo se ve un despacho que opera así:
renato-zapata.com/pitch

#SoftwareEngineering #Customs #AI
```

**Attach:** A small diagram or the actual commit graph from GitHub if
comfortable showing it.

---

## Template 5 — The "Inflection" Post

**Purpose:** Create urgency + position you as capacity-constrained
(scarcity is credibility on LinkedIn).

```
Cerramos abril con 10 clientes activos. Mayo aceptamos 5 más.

No porque seamos elitistas. Porque dos personas solo pueden honrar
tantas patentes 3596 bien.

Si cada cliente quiere operación de lujo — sus expedientes limpios,
su Anexo 24 auditado al día, su portal siempre actualizado — entonces
la matemática es 15 empresas con un clasificador + un broker.

Cuando cerremos a 15, pasamos a lista de espera y contratamos al
siguiente clasificador. Probablemente julio.

Si tu empresa importa >50 veces al mes y quieres una conversación
antes del verano:

→ Abre el demo público: renato-zapata.com/pitch
→ O mándame DM

No somos el despacho más grande. Somos el despacho mejor operado en
Laredo. Los números en el portal son reales y auditables.

Patente 3596 · Aduana 240 · Est. 1941

#ComercioExterior #Aduana
```

**Attach:** Optional — a graph showing monthly crossings processed
(even if small, the growth trajectory tells the story).

---

## Reply strategy on comments

When the post takes off:

- **Every comment in the first 2 hours gets a reply.** LinkedIn's
  algo rewards author-engagement in the first hour.
- **If someone comments something insightful → DM them within 24h.**
  Use linkedin-dms.md variant A ("Gracias por conectar…").
- **If a known competitor comments something snarky → don't engage.**
  Reply with a neutral thumbs-up-level comment, move on. No drama.
- **If a prospect asks a technical question → answer briefly in the
  comment, then offer the DM.** "Buena pregunta, mandaré DM con más
  detalle" — the DM is where the conversion happens.

---

## Post performance tracking (manual, first 20 posts)

Track in a simple Google Sheet:

| Date | Template | Impressions | Reactions | Comments | DMs received | Pipeline leads | Ship? |
|------|----------|-------------|-----------|----------|--------------|----------------|-------|

After 20 posts, pick the 2–3 templates with > 3× reaction rate +
most DMs. Kill the rest. Iterate from there.

**Rule of thumb:** any post with < 500 impressions is probably
getting suppressed — LinkedIn hates self-promotional + hashtag-heavy
posts. Dial back the promo copy, tighten the hook.

---

*Codified 2026-04-21 during Marathon 3 · HIGH-ROI marathon · Renato
Zapata IV founder voice — adapt to your own voice if reading this
file as someone else.*

---

## Extended set — Templates 6–10 (added Marathon 6 · 2026-04-21)

Five more templates covering different angles. Rotate through all 10
to avoid repetition; LinkedIn's algo punishes sameness.

---

## Template 6 — The "SAT Audit Week" Post

**Purpose:** Lead with a compliance pain every importer knows. Earn
credibility with a specific fix.

```
Esta semana cerramos el Q1 para uno de nuestros clientes. El SAT
pidió Formato 53 de los últimos 90 días.

Antes: alguien del equipo abre Excel. 4 horas de cruzar SKUs contra
pedimentos. 3 cafés. 2 errores que hay que corregir.

Hoy: click en Anexo 24, elegir "Trimestre", descargar. 12 segundos.

PDF + Excel con las 41 columnas SAT-canónicas. Trazable SKU por
SKU. Con el historial de quién clasificó qué y cuándo.

Cada importador mexicano va a pasar por esto cada 3 meses. La
pregunta no es "¿estás listo?" — es "¿cuánto tiempo de tu equipo
cuesta estar listo?".

Si quieres ver cómo se ve un Anexo 24 operado así, abre el demo
público:

renato-zapata.com/pitch

Sin registro. Sin email.

Patente 3596 · Aduana 240 · Laredo, TX · Est. 1941

#ComercioExterior #SAT #Aduana
```

**Attach:** screenshot of `/anexo-24` period picker + a piece of the
downloaded PDF (blurred-out client name).

---

## Template 7 — The "Data Integrity Moment" Post

**Purpose:** Make engineering rigor visible to CFOs who value it.

```
148,537 SKUs en tu catálogo. Para cada uno:

— clave de producto
— fracción arancelaria
— fundamento legal del CAAAREM
— fecha de clasificación y quién firmó
— últimos cruces con su semáforo

Ahora imaginá que un SKU tiene dato incorrecto. ¿Cuántos pedimentos
de los últimos 12 meses están afectados? ¿Cuándo se filió? ¿Cómo lo
arregles sin romper lo que sí funciona?

Esa trazabilidad es lo que construimos. No porque sea bonito — porque
es lo que el SAT exige en una auditoría, y lo que Tito exige cuando
firma algo con su patente 3596.

Data integrity no es un tema de software. Es un tema de licencias.

renato-zapata.com/pitch

#DataIntegrity #Compliance #Aduana
```

**Attach:** a small ASCII/Mermaid diagram of the classification
provenance chain.

---

## Template 8 — The "EVCO Case Study Teaser" Post

**Purpose:** Soft-launch social proof. Requires Ursula's written
permission first.

```
Un caso real — con permiso del cliente para contarlo.

EVCO Plastics de México. 148,537 SKUs activos. Cruzan Aduana 240
(Nuevo Laredo) 40-60 trailers por mes.

Antes de abril de 2026:
— Clasificar un SKU nuevo: 22 minutos
— Confirmar estado de un trafico: 40-60 minutos
— Sistemas separados: 5
— Semáforo verde al primer intento: 88%

Hoy:
— Clasificar un SKU nuevo: 2 minutos
— Confirmar estado de un trafico: sub-3 segundos
— Sistemas: 1 (el portal · GlobalPC queda en respaldo)
— Semáforo verde al primer intento: 98%

Ursula Banda, Directora de Operaciones, lo dice así: "Abro el portal
a las 11 PM, veo todo en una pantalla, y me voy a dormir."

Nuestro siguiente cliente arranca en Mayo. Si importas >50 veces al
mes y te interesa esta operación:

renato-zapata.com/pitch · DM abierto

Patente 3596 · Est. 1941

#ClientSuccess #Aduana #ComercioExterior
```

**Attach:** the official EVCO case study PDF (once approved via
the process in `scripts/cold-outreach/case-study-template.md`).

**IMPORTANT:** Do NOT publish this template until Ursula's written
permission is saved in `.planning/case-studies/evco-approval.txt`.

---

## Template 9 — The "85 Años" Storytelling Post

**Purpose:** Humanize the brand. Compete on heritage + modernity,
not on feature list.

```
Mi abuelo abrió la oficina de Renato Zapata & Co. en 1941.

La Patente 3596 llegó poco después. Aduana 240. Nuevo Laredo.

85 años. Cuatro generaciones cruzando la frontera. Mismo nombre
en la puerta.

Hace 6 meses, Tito (mi papá, director general hoy) y yo decidimos
que la siguiente década del despacho no puede ser la misma que las
8 anteriores. Decidimos construir un portal — con IA, con código
propio, con Next.js y Supabase y Anthropic — para que los
importadores que nos eligen sientan que están en 2026, no en 1990.

No somos una startup. Somos un despacho aduanal de 85 años que
decidió operar como startup. La diferencia importa.

Si tienes importaciones mexicanas y valoras precisión sobre
velocidad bruta:

renato-zapata.com/pitch

Dos personas. Patente 3596. Aduana 240. Laredo, Texas. Est. 1941.

#Storytelling #FamilyBusiness #Aduana
```

**Attach:** an old photo (1941-era storefront, a grandfather's
customs license, the patent document). This is the one post where
an old photograph outperforms any screenshot.

---

## Template 10 — The "AI-Native, Not AI-Washed" Post

**Purpose:** Speak to technical decision-makers who value rigor.

```
Todos los SaaS de logística dicen "with AI" en su homepage. Pocos
pueden decir qué modelo corre dónde, cuánto cuesta, y por qué.

Nosotros sí:

— Clasificación arancelaria (148K SKUs): Qwen, local, en nuestro
  Mac Studio. $0/consulta. Privacidad total.
— Respuestas en lenguaje natural (portal): Claude Sonnet,
  ~$0.003 por pregunta, con 50+ herramientas MCP-expuestas.
— Opinión de clasificación formal (OCA): Claude Opus, ~$0.12
  por documento, con fundamento legal citeable.

Cada llamada queda en audit_log. Cada modelo se usa donde su costo
y capacidad encajan. Nada inventado, nada hallucinated en producción
— si la AI no está segura, Tito revisa.

Esto es AI-nativo porque se diseñó AI-nativo desde el código. No es
un chatbot pegado encima de un CRM.

renato-zapata.com/pitch

#AI #EngineeringRigor #Aduana
```

**Attach:** a small architecture diagram (Qwen → Classification;
Sonnet → Portal AI; Opus → OCA) with per-model cost annotations.

---

## When to post each template

| Day | Template ideas |
|---|---|
| Tuesday AM | **4 (why we built it)** or **7 (data integrity)** — technical prospects check LinkedIn on the commute |
| Thursday AM | **2 (before/after)** or **6 (SAT audit week)** — operational prospects read over coffee |
| Tuesday after a client win | **8 (case study teaser — ONLY if approval)** |
| Quarterly | **9 (85 años storytelling)** — don't overuse |
| When a CTO/engineer DMed | **10 (AI-native)** — follow-up post within 3 days |

**Rotation rule:** don't post the same template twice in 30 days.
LinkedIn recognizes patterns and throttles.

---

*Templates 6–10 appended 2026-04-21 during Marathon 6 · Renato
Zapata IV founder voice. Adapt + track performance via the sheet
above.*
