# Monday Domain Warm-Up · 2026-04-20

**Why:** `ai@renatozapata.com` has low prior send volume. Sending 150 cold
emails cold (pun intended) on Tuesday will flag as spam — Gmail and
Outlook treat new-high-volume inboxes as suspicious. 10-20 real-looking
sends Monday teaches the inbox it's a real account.

**Rule:** Each send must look HUMAN. No signature templates with logos.
No marketing copy. Short, personal, asks for a reply. Every reply improves
our sender score dramatically — so pick recipients who WILL reply.

**Target:** 10-20 sends spread between 09:00 and 17:00 CT Monday. Don't
send them all in one batch (defeats the purpose). 1-2 per hour is ideal.

**Pro tip:** Reply to some of them yourself from another inbox. Every
back-and-forth thread improves deliverability 10x more than a one-shot
send.

---

## Batch 1 · Internal team (5-6 sends · safest)

### 1. To Tito (Renato III)

```
Subject: Prueba de bandeja nueva — respóndeme con OK

Tito,

Estoy activando la bandeja ai@renatozapata.com para el envío del martes.
Respóndeme aquí con un OK cuando lo veas — es para calentar el buzón
con replies reales antes del envío.

— Renato IV
```

Expect: Tito responds "OK" or similar within a few hours. That reply
thread boosts the sender score immediately.

### 2. To yourself (different inbox)

```
Subject: Test envío — 10:30 CT

Autoenvío de prueba. Borra este. No requiere respuesta.
```

Send to `renatozapatabot@gmail.com` or any personal Gmail. Confirms
delivery to Gmail specifically (the biggest recipient we'll hit Tuesday).
Don't reply — just verify it landed in Primary, not Promotions.

### 3. To Anabel

```
Subject: Bandeja nueva — ai@renatozapata.com

Anabel,

Activé la bandeja ai@renatozapata.com para el envío de prospección del
martes. Si te llega algo de clientes potenciales, reenvíamelo aquí.

Respóndeme con un OK cuando veas este.

Gracias,
Renato IV
```

### 4. To Eloisa

```
Subject: Bandeja nueva — ai@

Eloisa,

Te aviso que este martes empezamos envío de prospección por ai@renatozapata.com.
Si te llegan respuestas redirigidas a tu buzón, pásamelas. Respóndeme
con OK cuando leas.

— Renato IV
```

### 5. To Juan José / Arturo (operators)

```
Subject: Heads up — envío martes

Compañeros,

Este martes 10:00 mandamos una primera ola de prospección desde
ai@renatozapata.com a ~150 maquiladoras fuera de Laredo. Si les llaman
preguntando por Renato Zapata, pásenles mi celular o diles que yo les
devuelvo la llamada en la tarde.

Respóndanme con OK cuando vean esto.

Gracias,
Renato IV
```

---

## Batch 2 · Existing client (Ursula / EVCO — 1-2 sends)

### 6. To Ursula Banda (EVCO, if appropriate)

```
Subject: Heads up — nueva bandeja para avisos

Ursula,

Buenas tardes.

Te escribo desde la nueva bandeja ai@renatozapata.com — la usaremos
a partir del martes para comunicaciones automatizadas (recordatorios,
resúmenes semanales, etc.). El portal y el WhatsApp del equipo siguen
igual.

No requiere acción de tu parte. Solo si prefieres seguir recibiendo
todo desde el correo de Claudia, me avisas y lo dejamos así.

Saludos,
Renato Zapata IV
Renato Zapata & Co.
```

**Importante:** Este toca cliente real. CLAUDE.md approval gate: Tito o
Renato IV debe aprobar toda comunicación a cliente. Solo envíalo si
encaja con el plan de Ursula Monday 08:00. Si no, **salta este email**.

---

## Batch 3 · Warm contacts (3-5 sends)

Amigos del gremio, exproveedores, antiguos clientes con los que sigues
hablando. Personaliza CADA uno — no copy-paste.

### 7-10. Pattern para contactos warm

```
Subject: {{tema personal — no marketing}}

Hola {{nombre}},

¿Cómo anda todo por {{ciudad o empresa}}?

{{Una o dos líneas personales — recordar conversación pasada, preguntar por
su familia, mencionar algo actual}}.

Breve: Este martes activamos un envío grande desde una bandeja nueva
(ai@renatozapata.com) — este correo es parte del warm-up, pero también
quería decirte hola. Si te enteras de alguna maquiladora fuera de Laredo
que esté buscando despachante nuevo, recuérdanos.

Un abrazo,
Renato IV
```

**Reglas:**
- Cada uno es personalizado — menciona algo que ustedes dos recuerden
- No hables del "portal" ni de "AI" — esos son para prospectos fríos
- Pídele un favor pequeño (reply, referencia) — reply rate >90% en contactos
  warm

---

## Batch 4 · Fallback si faltan respuestas (3-5 sends)

Si después de 12:00 CT tienes menos de 5 replies recibidos, agrega
estos:

### 11. To Mario Ramos (GlobalPC) — CUIDADO

```
Subject: Confirmación rápida

Mario,

Buenas. Rapidita — ¿confirmas que te llega este correo desde
ai@renatozapata.com? Es una nueva bandeja que activamos para
comunicaciones internas.

No requiere más.

Saludos,
Renato IV
```

**Cuidado:** No menciones el portal ni la campaña de prospección a Mario.
La regla operativa es que Mario no debe percibir CRUZ/PORTAL como
competencia a GlobalPC. Este correo es puramente técnico.

### 12-15. Exclientes o prospectos fríos previos

Si has enviado cold emails antes desde otras cuentas y esos prospectos
respondieron (aunque sea un "no gracias"), incluyelos ahora en el warm-up
con un "pequeño follow-up de hace {X} meses." Mantén ligero.

---

## Qué NO hacer durante el warm-up

- No mandar el PDF de prospección (está optimizado para cold, no warm)
- No mandar correos con mucho HTML o imágenes (dispara filtros)
- No mandar en ráfaga a las 09:00 (sospechoso) — espaciar
- No mandar a listas compradas o bandejas no verificadas
- No incluir la palabra "oferta" o "promoción" (palabras spam)
- No poner 5+ enlaces en un correo
- No mandar desde VPN/proxy (rompe el fingerprint de IP)

---

## Cómo mandar

Puedes mandar cada uno **directamente desde Gmail** si ai@renatozapata.com
está enlazado a una cuenta Gmail Workspace, O usar el script corto:

```bash
# Opción A — manual desde Gmail / Apple Mail (recomendado, más "humano")
# Solo inicia sesión en ai@renatozapata.com y escribe cada uno a mano.

# Opción B — vía Resend API (si no tienes acceso directo a Gmail)
# Archivo: scripts/cold-outreach/send-warmup.ts (a crear si lo necesitas)
```

**Preferencia:** Manual desde Gmail. Los filtros de spam distinguen
envíos API de envíos humanos — y el warm-up quiere parecerse al humano.

---

## Checklist de Monday 17:00 (antes de salir)

- [ ] ≥10 correos de warm-up enviados desde ai@renatozapata.com
- [ ] ≥5 replies recibidos de vuelta (preferible ≥8)
- [ ] DMARC/SPF/DKIM verificados en mxtoolbox.com para renatozapata.com
- [ ] Nada cayó en Spam al enviar a un Gmail de prueba
- [ ] Nada cayó en Promotions (si sí, ajustar copy — menos formalidad)
- [ ] Tito revisó el PDF y la copy del martes. "Está bien" explícito
- [ ] COLD_OUTREACH_PHONE y COLD_OUTREACH_WHATSAPP en .env.local

Si cualquiera de los 4 primeros falla → postpón el envío del martes.
Mejor mandar el miércoles con reputación limpia que el martes con
reputación quemada.

---

*Pre-drafted 2026-04-19 · Patente 3596*
