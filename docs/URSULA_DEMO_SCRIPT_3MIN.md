# Ursula Demo Script — 3-minute lightning walkthrough

> **Open this on your phone during the demo.** The full 14-minute
> playbook is in `docs/EVCO_DEMO_PLAYBOOK.md`. This short version is
> for when Ursula has 3 minutes, a stakeholder cold-joined, or
> you're doing a second-round check-in and don't want to re-cover
> everything.
>
> Target length: **3 minutes.** Under 2 = shallow. Over 4 = you lost
> the thread. Stick to the script.

---

## Pre-open

1. `portal.renatozapata.com/login` (logged in with `evco2026`)
2. Zoom 100%. Dev console CLOSED. Slack muted.
3. Breathe once.

---

## 0:00 – 0:30 · `/inicio` — the cockpit moment

**Login → land on `/inicio`.**

Say *(pointing to the greeting)*:

> "Esto es lo que ves cada mañana a las 11 PM desde tu teléfono.
> EVCO Plastics, en vivo. 99.8% liberación inmediata — 2,548 verdes
> de 2,552 cruces. Esa es tu patente haciendo su trabajo."

**Do not click anything.** Let her see the 4 nav tiles + freshness
badge for 5 seconds.

## 0:30 – 1:15 · `/catalogo` — the catálogo moment

**Click:** Catálogo tile (tile #4).

Say:

> "148,537 SKUs. Todos clasificados con IA, revisados por Tito.
> Busca cualquier parte por clave, por descripción, por fracción."

**Action:** type `6600-1108` (or `PC-10FRN` — both return real EVCO
SKUs with rich crossing history). Click any result.

When the part detail loads, say:

> "Aquí está la fracción arancelaria propuesta por la IA, con el
> fundamento legal del CAAAREM — y los pedimentos reales de los
> últimos cruces. Cada pedimento formateado SAT-canónico, cada
> semáforo auditable. 22 minutos antes, 2 minutos hoy."

**M12 signal (post-phantom-column fix):** the table now shows real
pedimento numbers (DD AD PPPP SSSSSSS), real fechas, real semáforos
per row. Pre-M12 this was silently empty. Point at the pedimento
column — "cada uno tiene su registro SAT completo" — and let the
density speak.

## 1:15 – 2:00 · `/anexo-24` — the SAT moment

**Click:** Anexo 24 tile (or the nav link).

Say:

> "El Formato 53 — lo que el SAT te pide en una auditoría. Elige un
> período, descargas PDF + Excel con las 41 columnas SAT-canónicas,
> todo cruzado con tu catálogo. Sin Excel. Sin sorpresas."

**Action:** click the period picker, show the options (Mes /
Trimestre / Año / Personalizado). **Don't actually download.**

## 2:00 – 2:30 · `/mi-cuenta` — the A/R moment

**Click:** Contabilidad tile (tile #2 for client role) → lands on
`/mi-cuenta`.

Say:

> "Tu estado de cuenta con nosotros. Saldo, facturas, pagos del mes.
> Si algo no te cuadra, Anabel responde en Mensajería. Sin llamadas,
> sin buscar emails."

**Don't click anything.** Silver chrome, no red fonts — that calm
tone is intentional and she'll feel it.

## 2:30 – 3:00 · The close

**Click back to `/inicio`.**

Say:

> "Todo esto sincroniza cada 30 minutos desde la aduana. Tito
> aprueba lo importante. La IA hace lo tedioso. Dos personas,
> patente 3596, 85 años en la frontera. Esta semana te mando las
> credenciales oficiales."

**Stop talking. Let her react.**

---

## If she asks anything — one-line answers

- **"¿Cuánto cuesta?"** → "$15K setup · $8K/mes ongoing — detalles en
  el PDF que te mando."
- **"¿Cuándo empezamos?"** → "Credenciales esta semana, onboarding
  48 horas."
- **"¿Cómo se compara con GlobalPC?"** → "GlobalPC sigue siendo la
  fuente de verdad. Nosotros somos el lente moderno encima — no
  lo reemplazamos, lo hacemos utilizable."
- **"¿Y si ustedes dos se enferman?"** → "Todo en GitHub, Supabase,
  Vercel. Tito tiene acceso admin completo. El sistema sigue
  corriendo."

More questions → pull out full playbook §2.

---

## After the demo — within 1 hour

1. `/admin/leads/[EVCO's-lead-id]` → log activity `email_sent`
   ("Demo 3-min con Ursula · [outcome]")
2. Move stage if warranted
3. Send the PDF: `/api/pitch-pdf?firm=EVCO&name=Ursula&download=1`
4. One-line Telegram to Tito: "Demo corto con Ursula · [outcome]"

---

## The goal in one sentence

When you finish, Ursula should feel: **"Yo quiero abrir esto a las
11 PM."**

That's it. If she says anything close — or you can see it in her
eyes — you won.

---

*Drafted 2026-04-21 · Marathon 6 · Renato Zapata IV.
Longer playbook: `docs/EVCO_DEMO_PLAYBOOK.md`.*
