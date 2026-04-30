# Post-Demo Follow-up Sequence

Every lead whose stage in `leads` is `demo-viewed` triggers this
sequence. Three emails spread over ~10 days. Manual for now (Renato
IV sends from his own account, not ai@); automate after the first
five successful close cycles prove the cadence works.

## Timing

```
T+0 (same day, within 2h of the demo hit)   → Email 1 · thank-you + signal
T+3 (three business days later)              → Email 2 · pricing + booking link
T+7 (seven business days later)              → Email 3 · soft nudge + case study
If no reply after T+14                       → mark stage='nurture' in /admin/leads
```

Do NOT send Email 2 if the lead already replied to Email 1. Let the
conversation go where it wants.

Do NOT send all three on the same trigger. Space them. Reading three
sequence emails at once is the clearest "this is automated spam"
signal a prospect gets.

---

## Email 1 — Thank-you + signal (T+0)

**Subject lines (pick one; rotate by industry):**
- `Gracias por ver el demo ({{firm_name}})`
- `Después del demo — una nota rápida`
- `{{first_name}} — gracias por el tiempo hoy`

**Body:**

```
Hola {{first_name}},

Gracias por explorar el portal. Quería dejarte una nota rápida
mientras lo tienes fresco.

Tres cosas que los operadores me suelen decir después del primer
vistazo — a ver si alguna te hizo click:

1) "Por fin puedo ver dónde está mi embarque sin llamar al agente."
2) "No sabía que podía filtrar mi Anexo 24 por fracción arancelaria."
3) "El semáforo en tiempo real cambia cómo planeo mi semana."

Si alguna de estas fue tu momento, respondes y programamos una
llamada de 20 minutos con mi papá (Patente 3596) para hablar de
tu operación específica — sin pitch, sin presentación.

Saludos,
Renato Zapata IV
Renato Zapata & Company · Est. 1941
portal.renatozapata.com/pitch
```

**Why this works:**
- No "let's jump on a call" cold-close opener
- Three concrete value anchors they can map to their own workflow
- Offers a call with Tito (the patente holder, not the sales guy) —
  higher-trust signal than "our sales team"
- "20 minutes" is short enough to be low-stakes
- The signature links back to `/pitch` for forward-share

---

## Email 2 — Pricing + booking (T+3)

**Subject lines:**
- `Números redondos — para que no haya sorpresas`
- `Precio + cómo agendar llamada`
- `{{first_name}} — esto es lo que cuesta`

**Body:**

```
Hola {{first_name}},

Follow-up corto. Probablemente te preguntaste "¿cuánto cuesta esto?"
pero no quisiste romper el flow del demo — así que lo pongo aquí.

Nuestro modelo es simple:

  → Setup + migración inicial:   $15,000 MXN (una vez)
  → Mensualidad:                 desde $8,000 MXN / mes
  → Basado en volumen:           crosses + expedientes activos

Incluye:
  - Portal 24/7 con tu operación en vivo
  - Clasificación con IA + revisión de Tito
  - Anexo 24 sincronizado con Formato 53
  - Soporte directo por WhatsApp/Mensajería

No cobramos por "usuario" — toda tu operación opera con la misma
cuota. Si tienes 3 compradores, 5 operadores, y un plant manager
viendo el dashboard, todos están incluidos.

Si quieres seguir, el próximo paso es una llamada de 20 minutos
con Tito. Agéndalo aquí:

  {{calendar_link}}

O responde este correo con un par de opciones de tiempo — lo que
sea más fácil para ti.

Saludos,
Renato IV
```

**Why this works:**
- Opens with "probablemente te preguntaste" — acknowledges the
  thought without making them ask
- Prices are concrete, not "starting at" fog
- "No cobramos por usuario" removes a common objection up-front
- Clear next step: calendar link OR email reply — both are low-effort

**Replace `{{calendar_link}}`** with actual Cal.com / Calendly / etc
URL before sending. Keep a default in `scripts/cold-outreach/templates.ts`.

---

## Email 3 — Soft nudge + case study (T+7)

**Subject lines:**
- `Caso real — 22 minutos → 2 minutos`
- `{{first_name}} — ¿aterrizó esto?`
- `El caso de EVCO (y por qué cambió)`

**Body:**

```
Hola {{first_name}},

Sé que una semana se pasa rápido. Último toque por ahora.

Si el pricing fue el blocker, aquí está el caso concreto:

EVCO Plastics nos contrató porque su proceso de clasificación manual
promediaba 22 minutos por SKU. Con el portal, el mismo paso baja a
2 minutos — con fundamento legal, historial, y SuperTito revisando
al final.

Ursula Banda, Dir. de Operaciones:
  "Abro el portal a las 11 PM, veo todo en una pantalla,
   y me voy a dormir. Esto no existía antes."

Si quieres ver el caso entero con números + métricas, está aquí:

  https://portal.renatozapata.com/pitch

Y si ahora no es el momento — sin problema. Deja este hilo abierto.
Si en 3 o 6 meses cambia el contexto, responde aquí y seguimos.

Saludos,
Renato IV
```

**Why this works:**
- Acknowledges the silence without guilting
- Anchors with a real client name + real metric + real quote
- The quote is the one on the `/pitch` testimonial component — single
  source of truth across every surface
- "Sin problema" ending — permission to not respond
- Keeps the door open with "3 o 6 meses" — matches reality of
  procurement cycles in this segment

---

## Reply handling

If the prospect replies at any point in the sequence → **stop all
subsequent emails**. Mark the stage in `/admin/leads`:

- Interested / wants to learn more → `stage='negotiating'`,
  set `next_action_at` to the next meeting
- Wants demo again → `stage='demo-booked'`,
  send the calendar link
- Not now, maybe later → `stage='nurture'`,
  `next_action_at` = today + 90 days
- Has a broker, not interested → `stage='lost'`,
  notes field: reason if they shared one
- Ghosts through the sequence → `stage='nurture'` after T+14

See `reply-templates.md` for the canonical response bodies for each
of these 5 reply shapes.

---

## Metrics to track

Fill these in `/admin/leads` as a column or derived metric. Goal is
to know after 3 months whether this sequence converts or not.

- Open rate per email (requires pixel tracking — out of scope today)
- Reply rate per email (count replies per sent)
- Time-to-reply from first send
- Stage at T+14 for every lead that entered at `demo-viewed`
- `won` rate from `demo-viewed` starting stage

The first 5 cycles are qualitative — Renato IV reads every reply.
Don't add dashboards until we have enough replies to see a pattern.

---

*Codified 2026-04-21 · post-/pitch + /demo launch · Renato Zapata IV.*
