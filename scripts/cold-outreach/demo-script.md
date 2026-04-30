# Demo Script — 3-Minute Loom Walkthrough

**Purpose:** A spoken-script for a sub-3-minute Loom video that walks
a cold prospect through the product without requiring a live call.

**When to send:** After the T+3 pricing email in `post-demo-sequence.md`
or when a prospect replies "tell me more" — paste the Loom link,
same day.

**Target length:** 2:30 to 3:00. Under 2:00 feels shallow. Over 3:00
and you lose them at 2:15.

**Setup before recording:**
- Chrome fullscreen, Loom extension webcam in bottom-right corner
- Open three tabs in order:
  1. `portal.renatozapata.com/pitch` (hero)
  2. `portal.renatozapata.com/demo/live` (cockpit view)
  3. `portal.renatozapata.com/catalogo/[a-real-cve]` (parte detail
     showing classification + Anexo 24 audit)
- Silent Slack, silent iMessage, silent email. No popups.
- Glass of water off-camera. Breathe before you hit record.

**Recording rules:**
- One take. Don't edit. Loom raw feels real; polished feels sold.
- Don't say "um" — but if you do, keep going. Editing reveals
  inexperience. Raw reveals confidence.
- Speak slower than feels natural. 140 wpm, not 180.

---

## The script (with timing cues)

### 0:00 – 0:15 · Hook + name + why you're sending this

> "Hola, soy Renato Zapata IV de Renato Zapata & Company — despacho
> aduanal en Laredo, patente 3596, fundados en 1941. Te mandé este
> video porque [NAME OF PROSPECT'S COMPANY] importa desde China o
> EE.UU., y creo que vale 2 minutos de tu día ver cómo se ve un
> despacho que opera con IA."

**Pause 1 second.** Click to tab 1 — `/pitch`.

### 0:15 – 0:45 · The 22 → 2 min delta (show, don't tell)

> "Esto es lo que estamos haciendo con EVCO Plastics de México.
> Antes, clasificar un SKU tomaba 22 minutos: abrir Excel, buscar
> en el CAAAREM, redactar el fundamento, generar el PDF, firmar.
>
> Hoy, con nuestro portal, son 2 minutos. Mismo rigor. Misma
> patente 3596. Diez veces más rápido."

**Scroll slowly through the metrics row on `/pitch`** — let the
numbers land: 148,537 SKUs · Patente 3596 · 98% liberación · 1941.

### 0:45 – 1:30 · The operator view (the "wow")

**Switch to tab 2 — `/demo/live`.**

> "Esto es el cockpit. Aguantad dos segundos, porque este es el
> momento que usualmente sorprende.
>
> Esto no es una demo de diseño. Son datos reales de una empresa
> ficticia — le llamamos DEMO PLASTICS — que respetan toda la
> estructura que Ursula, nuestro contacto en EVCO, ve cada
> mañana a las 11 PM cuando abre su teléfono para ver el estado
> de su operación.
>
> Arriba, los tráficos activos. Abajo, los pedimentos del mes.
> A la derecha, clasificaciones pendientes — cosas donde el AI
> no tuvo suficiente confianza y nos pide que veamos. Tito revisa,
> firma, se guarda."

**Don't click anything yet.** Just hover the cursor over each
section while you speak. Mouse movement = teaching.

### 1:30 – 2:15 · The specific moment (the proof)

**Switch to tab 3 — parte detail page.**

> "Abramos una clasificación concreta. Este es el SKU XR-847.
>
> Arriba ves la fracción arancelaria que el AI propuso — 3901.20.01,
> polietileno de baja densidad. Abajo ves el fundamento legal:
> Regla General 1 del CAAAREM, cruzada con el Anexo 24 que
> EVCO ya entregó al SAT.
>
> Y aquí, esta tabla — son los últimos 4 cruces del mismo SKU,
> todos con semáforo verde. Eso es credibilidad. Cuando Ursula
> abre esto a las 11:47 PM antes de un cruce, no está adivinando.
> Está viendo el historial auditable."

**Scroll the classification history slowly.** Let the prospect
see it's real, not a mockup.

### 2:15 – 2:45 · The close (soft, not pushy)

**Switch back to tab 1 — `/pitch`.**

> "Si esto hace sentido para [COMPANY NAME], lo siguiente es muy
> simple: te mandaría la credencial de un portal de prueba — con
> tus propios datos históricos, no con DEMO PLASTICS — para que
> tu equipo vea cómo se vería en tu operación.
>
> No hay onboarding de 3 meses. No hay integración complicada.
> Conectamos con GlobalPC o con tu sistema actual en 48 horas.
>
> El precio es transparente y está en el portal — si quieres verlo,
> hay un PDF descargable aquí: [apunta al botón 'Descargar 1-pager'].
>
> Si tienes preguntas, respondo DM o email en 2 horas. No tengo
> equipo de ventas que te rastree — esto llega directo a mí."

### 2:45 – 3:00 · Sign-off

> "Dos personas. Patente 3596. Aduana 240. Laredo, Texas.
> Gracias por los 3 minutos."

**Small smile. Don't say "hope to hear from you soon."** Let the
silence after "gracias" do the work.

**Stop recording.**

---

## Post-record checklist

1. Watch the whole thing once. If you cringe once, re-record. If
   you cringe twice, fix the script.
2. Rename the Loom: `EVCO-portal-demo-[prospect-company-name]`
3. Send the Loom link in a 2-line email (no subject-line marketing):

> "Hola [NAME] — 3 min sobre lo que hacemos con patente 3596.
> Si hace sentido, respondeme. Si no, ignoralo sin culpa.
> [LOOM_LINK]
> — Renato"

4. Log the send in `/admin/leads/[id]` as an `email_sent` activity
   with summary "Demo Loom enviado — [Loom URL]".

---

## Variations

### For a CFO (cost-focused)

Replace the 0:00-0:15 hook with:

> "…creo que vale 2 minutos por el ahorro: con EVCO estamos saving
> aproximadamente $X,XXX MXN mensuales en tiempo de clasificación
> manual, y ahí ni entramos en los penaltys que evitamos por
> Anexo 24 auditado."

### For a Plant Director (operation-focused)

Replace the 1:30-2:15 with a scroll through `/traficos` showing
shipment tracking, semáforo status, bridge timing. Don't go into
classification detail — they don't care.

### For a Technical/Engineering lead

Add a 15-second callout on tab 3: "Este portal corre en Next.js,
Supabase, OpenAI y Anthropic. No terceros. No licencias. Nosotros
escribimos cada línea." — technical prospects respect this.

---

*Drafted 2026-04-21 · adapt the PAUSE cues the first time you
record so the rhythm feels natural.*
