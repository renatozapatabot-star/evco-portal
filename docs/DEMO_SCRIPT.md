# AGUILA V1.5 · Demo Script (5 minutes)

**Purpose:** A repeatable, memorable walkthrough so every visitor leaves with the same impression — AGUILA is intelligence at every border, not another portal.

---

## Setup (30 seconds before the visitor walks in)

1. Open `/admin/demo` and click **"Iniciar demo"** (F9). This seeds a synthetic tráfico lifecycle so the ambient activity feels alive when the visitor arrives — pulses on the corridor, ticker updates, Eagle tiles blinking.
2. Keep a second browser tab on `/corredor` visible and ready.
3. Have a phone nearby, logged in as the warehouse role, on `/bodega/escanear`.
4. Pull up Telegram on that same phone, muted but visible.

---

## 5-Minute Walkthrough

Each step: **Click** → **Say** → **Pause**.

### Step 1 · 0:00–0:45 — The Corridor

- **Click:** `/corredor` (F4 corridor map).
- **Say:** *"This is the 2-mile window from Nuevo Laredo to Laredo. Every pulse you see is a real shipment moving. We see it all, in real time. No phone calls. No 'where's my truck.'"*
- **Pause:** 2–3 seconds while a silver pulse flashes across the bridge.

### Step 2 · 0:45–1:30 — The Eagle View

- **Click:** `/admin/eagle` (F6).
- **Say:** *"My father opens this with his morning coffee. Six tiles. Every tile is a decision waiting to be made."*
- **Click:** the dormant-clients tile.
- **Say:** *"Duratech — 23 days quiet. One click sends a follow-up draft. No client falls through the cracks."*

### Step 3 · 1:30–2:30 — The Trace

- **Click:** `/traficos/[id]/trace` on the synthetic demo tráfico (F8).
- **Say:** *"From the trailer pulling into the yard, to the pedimento, to the bank payment, to the QuickBooks export — one unified thread. Nothing lost. Nothing untracked. Every handoff signed, every document attached."*
- **Pause:** 3 seconds while the visitor's eyes walk the timeline top to bottom.

### Step 4 · 2:30–3:15 — The Warehouse

- **Click:** on the phone — `/bodega/escanear` (F1).
- **Say:** *"Vicente, our warehouse supervisor, scans a QR code when a trailer backs up to the dock. The entrada is filed instantly, the corridor pulses, the next step is surfaced for the operator upstairs."*
- **Scan:** the pre-printed demo QR code with the phone camera.

### Step 5 · 3:15–4:00 — The Accounting Handoff

- **Click:** `/admin/quickbooks-export` (F2).
- **Say:** *"Anabel, our accountant, clicks one button at month-end. Every invoice flows into QuickBooks Desktop as an IIF file. Hours become minutes. Month-end close becomes a ritual, not a crisis."*

### Step 6 · 4:00–4:30 — The Alert

- **Click:** bring the phone forward to show the Telegram channel (F12).
- **Say:** *"Tito gets this on his phone as it happens. Patente 3596 is never out of the loop — wherever he is, the license is seeing what the system sees."*

### Step 7 · 4:30–5:00 — Close

- **Click:** back to `/admin/eagle`.
- **Say:** *"AGUILA isn't a tool. It's intelligence at every border. Built by two people, for a border our family has crossed since 1941."*
- **Pause:** full stop. Let the last line land.

---

## Pause-for-Impact Moments

Three moments in the script where you wait 2–3 seconds in silence and let the visitor absorb:

1. **End of Step 1** — after the corridor pulse flashes.
2. **Middle of Step 3** — while they trace the full timeline with their eyes.
3. **End of Step 7** — after "since 1941." Do not speak. Let them speak first.

---

## Questions to Ask at the End

Leave with these three in this order:

1. *"What's the single biggest pain in your current customs workflow?"*
2. *"Who on your team would use this first?"*
3. *"What would change for you if a shipment never got lost in email?"*

---

## Follow-Up Email Template

### Español (es-MX)

> **Asunto:** AGUILA · acceso de demo
>
> [Nombre],
>
> Gracias por su tiempo hoy. Dejo abajo las credenciales de demo para que exploren AGUILA con calma.
>
> **Portal:** https://evco-portal.vercel.app
> **Usuario:** demo@[cliente].mx · **Clave:** (enviada por separado)
>
> Cualquier duda, a la orden.
>
> Renato Zapata IV
> Casa Zapata · Patente 3596

### English (en-US)

> **Subject:** AGUILA · demo access
>
> [Name],
>
> Thank you for your time today. Demo credentials below so you can explore AGUILA at your own pace.
>
> **Portal:** https://evco-portal.vercel.app
> **User:** demo@[client].com · **Password:** (sent separately)
>
> Any questions, I'm one message away.
>
> Renato Zapata IV
> Casa Zapata · Patente 3596

---

## Video Recording Checklist

Renato records a 5-minute screen capture of the demo using QuickTime / OBS; saves to `docs/demo-video/` (path to be populated later).

Before recording:

- [ ] Turn off all notifications (macOS Focus · Do Not Disturb).
- [ ] Close every unrelated browser tab.
- [ ] Run `/admin/demo → Iniciar demo` first so the ambient activity is alive.
- [ ] Start the recording with the browser already on `/corredor`.
- [ ] Phone camera pre-focused on the QR code for Step 4.
- [ ] Telegram open on phone for Step 6.
- [ ] 5:00 max. Cut hard at the close.

After recording:

- [ ] Save to `docs/demo-video/aguila-v15-demo-YYYY-MM-DD.mov`.
- [ ] Thumbnail at Step 3 (the trace).
- [ ] No edits except trimming start/end silence. This is not a sales reel; it's a truthful walkthrough.
