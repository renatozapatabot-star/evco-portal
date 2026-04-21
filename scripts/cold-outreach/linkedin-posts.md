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
