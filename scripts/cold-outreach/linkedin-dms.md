# LinkedIn Parallel Wave · 2026-04-20 PM

**Why:** LinkedIn DMs reach decision-makers who ignore their work inbox.
Running this in PARALLEL with the Tuesday email campaign doubles contact
surface without adding marginal cost. Renato IV sends these manually from
his personal LinkedIn — no automation (LinkedIn bans it, and manual feels
more reputational anyway).

**When:** Monday PM (2026-04-20) — **before** Tuesday email fires. That
way, the email's subject line looks familiar when it lands Tuesday 10:00.

**Cadence:** 10-15 DMs over 2-3 hours. Don't send in burst. LinkedIn
throttles "obvious campaign" senders. Sprinkled feels human.

**Target:** 30-40 decision-makers from the Apollo-enriched top 150.
Prioritize titles: Director de Comercio Exterior · Gerente de Importaciones ·
VP Supply Chain · Country Manager · Trade Compliance. Skip plant managers
who don't own broker selection.

---

## Connection Request Note (≤300 chars · LinkedIn's limit)

LinkedIn's connection note caps at 300 characters. Use every one.

```
Hola {{first_name}} — somos despacho aduanal en Laredo (Patente 3596,
Est. 1941). Acabamos de relanzar la operación con IA — portal en vivo
para comercio exterior. Me gustaría conectar por si alguna vez les
sirve una segunda opinión. Saludos.
```

Character count: ~295. Leaves room for name length variation.

**Reglas:**
- NUNCA "I'd love to discuss opportunities" o equivalente — clichésimo
- NUNCA links en la connection note (LinkedIn los ve como spam)
- SÍ menciona patente + 1941 (diferenciador + trust anchor)
- SÍ menciona su nombre propio (personalización básica)
- SÍ termina con "Saludos" (respeta norma de conversación cálida)

---

## Follow-up DM (después de que aceptan) — Variant A

**Cuando aceptan la conexión:** dentro de las siguientes 24 horas, manda
esto. LinkedIn permite hasta ~2000 caracteres en DM — pero menos es más.

```
Gracias por conectar, {{first_name}}.

Breve contexto: dirijo la operación técnica de Renato Zapata & Company
— mi papá tiene la Patente 3596, familia en la frontera desde 1941.
Este año reconstruimos el despacho con IA: portal en vivo con pedimentos,
expedientes, semáforo, y cotización binding sin sorpresas. Despachamos
email a cruce en menos de 4 segundos.

Vi que {{company}} mueve volumen {{industry_cue — p.ej. "automotriz"
o "electrónica"}} por la zona {{state}}. Si alguna vez quieren una
segunda opinión sin compromiso — clasificación dudosa, semáforo rojo
atorado, pedimento urgente — mi teléfono es {{phone}}, WhatsApp el
mismo.

Te mando por aquí una hoja de una página con los números. Si no les
hace sentido, no me vuelves a oír. Si sí, hablamos cuando gustes.

— Renato IV
```

**Attach:** la misma hoja de pitch-pdf.tsx renderizada como PDF.
Súbela manualmente al DM. LinkedIn acepta PDFs ≤5MB (la nuestra es ~6KB).

---

## Follow-up DM — Variant B (para C-level / Director General)

Cuando conectas con un DG o VP, el tono sube un grado. Menos producto,
más relación.

```
Gracias por la conexión, {{first_name}}.

Vi tu trayectoria con {{company}} — enhorabuena por {{specific achievement
— expansión, nueva planta, reconocimiento gremio}}. Respeto mucho operaciones
de ese tamaño cruzando por 240.

Soy Renato Zapata IV. Mi papá lleva la Patente 3596 desde hace décadas
y nuestra familia cruzando por Laredo desde 1941. Este año rehicimos
el despacho con tecnología propia — portal en vivo, cotización con
números claros, despacho automatizado sin perder la mano humana.

No te pido nada hoy. Solo quería presentarme por si alguna vez quieren
una conversación — ustedes con el foro abierto y nosotros atentos.

Un abrazo,
Renato IV
```

Tone: peer-to-peer, no vendor → buyer. Los DGs responden a pares, no a
pitches. Nota: NO adjuntes PDF en este. Es conversación, no cotización.

---

## Si responden con interés

Mismo playbook que `reply-templates.md` Template A — bookear 15 min.
Agrega al principio: "Gusto en saber de ti, {{first_name}}. Aquí te dejo
horarios para esta semana."

No importa si la conversación empezó en LinkedIn — la llamada se agenda
como cualquier otra. Puedes pasarlo a WhatsApp para coordinar ("¿Me pasas
tu WhatsApp para coordinar? Es más rápido que LinkedIn.").

---

## Si NO responden después de 7 días

Deja morir el thread. No follow-up. LinkedIn follow-ups sin respuesta
son mucho más invasivos que email follow-ups — tu perfil aparece en
su feed y se ve desesperado.

Lo que SÍ hacer: cada 2-3 meses, darles un like a un post suyo relevante.
Relación de bajo calor, larga duración. Para cuando el broker actual
falle (y fallará — pasa a todos), tú estás en su mente.

---

## Lo que NO hacer en LinkedIn

- No InMail en frío sin conexión aceptada (se ve como telemarketing)
- No enviar connection request sin nota (low response rate)
- No mencionar a competidores aunque los conozcas (quemas relación)
- No publicar contenido corporativo durante esta semana (diluye tu
  perfil frente a las nuevas conexiones que están viendo)
- No enlazar directamente a Calendly en el primer DM (presión)
- No etiquetar a nadie en publicaciones tuyas (ruido)

---

## Script para generar la lista de target

Cuando la enriquecedura de Apollo esté lista, ejecuta:

```bash
# Pendiente — no implementado aún. Extraer de la CSV de Apollo:
#   - Filtrar títulos: "Director|Gerente|VP|Country Manager|Trade Compliance"
#   - Ordenar por volumen estimado
#   - Top 30-40 → copiar a LinkedIn manualmente
#
# Formato salida sugerido (para ti, no automatizable):
#
#   | LinkedIn URL | Nombre | Título | Empresa | Estado | Ped/mo |
#
# Pega la URL, escribe la connection note personalizada con el campo
# Nombre, enviar.
```

Por ahora: cuando tengas el export de Apollo, abre la CSV en Numbers,
filtra por título relevante, copia la columna LinkedIn URL, abre cada
perfil a mano y manda connection + nota. 3-4 min por prospecto × 30 =
~2 horas Monday PM.

---

## Checklist LinkedIn Monday EOD

- [ ] 30+ connection requests enviados (no más — LinkedIn flaggea)
- [ ] Cada uno personalizado con nombre propio
- [ ] No 2 con exactamente la misma nota (LinkedIn detecta)
- [ ] Espacio entre envíos (1-2 minutos mínimo)
- [ ] Headline de tu perfil actualizada: "Renato Zapata IV · Patente 3596 ·
      portal.renatozapata.com"
- [ ] Foto profesional + banner RZC visible
- [ ] Post reciente (últimos 7 días) coherente con el pitch — para cuando
      los prospectos miren tu perfil, no encuentren un perfil silencioso

**Si NO tienes post reciente:** publica algo hoy. Una frase del estilo
"Reconstruimos el despacho con IA este año. La frontera la cruza nuestra
familia desde 1941. Al fin tecnología que honra la tradición." + 1-2
imágenes. No marketing duro, más manifiesto corto.

---

*Pre-drafted 2026-04-19 · Patente 3596 · LinkedIn manual only, no automation*
