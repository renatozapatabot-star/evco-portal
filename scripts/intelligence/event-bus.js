#!/usr/bin/env node
/**
 * CRUZ Event Bus — Module Communication Backbone
 * 
 * This is NOT a stub. When module A emits an event, modules B/C/D
 * are actually called with the payload.
 * 
 * Event flow:
 * 1. Module calls emitEvent('missing_document', payload)
 * 2. Event saved to cruz_events table
 * 3. Each subscriber module's handler is called immediately
 * 4. Results logged, event marked processed
 * 
 * Also runs as a daemon to process any queued events (cron fallback).
 * 
 * Patente 3596 · Aduana 240
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// MODULE HANDLERS — Each maps to a real function
// ============================================================================

const { callQwen } = require('./qwen-client-v2');

/**
 * Handler: Supplier Negotiator — drafts email requesting missing docs
 */
async function handleSupplierNegotiator(payload) {
  const { document_type, trafico, supplier, clave_cliente } = payload;

  const { output, confidence } = await callQwen(
    `Eres el negociador de documentos de una agencia aduanal en Laredo, Texas.

Necesitamos solicitar al proveedor un documento faltante:
- Tipo documento: ${document_type}
- Tráfico: ${trafico}
- Proveedor: ${supplier}
- Cliente: ${clave_cliente}

Redacta un email profesional y cortés en español solicitando el documento.
Incluye: urgencia, consecuencias del retraso, fecha límite sugerida.
Formato: Asunto + Cuerpo del email.`,
    { module: 'supplier-negotiator', temperature: 0.4 }
  );

  return { action: 'email_drafted', email: output, confidence };
}

/**
 * Handler: Deadline Calendar — sets follow-up deadline
 */
async function handleDeadlineCalendar(payload) {
  const { document_type, trafico, due_date } = payload;

  // Calculate deadline: if no due_date, set 72 hours from now
  const deadline = due_date || new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  await supabase.from('cruz_events').insert({
    event_type: 'deadline_set',
    source_module: 'deadline-calendar',
    payload: {
      trafico,
      document_type,
      deadline,
      reminder_at: new Date(new Date(deadline).getTime() - 24 * 3600 * 1000).toISOString(),
      escalation_at: deadline,
    },
    processed: true,
  });

  return { action: 'deadline_set', deadline, trafico };
}

/**
 * Handler: MVE Predictor — recalculates risk with new info
 */
async function handleMVEPredictor(payload) {
  const { trafico, clave_cliente, delay_reason } = payload;

  const { output, confidence } = await callQwen(
    `Eres el predictor de riesgo MVE (Manifestación de Valor en Aduana).

Se detectó un evento que afecta el riesgo MVE:
- Tráfico: ${trafico}
- Motivo: ${delay_reason || 'documento faltante'}
- Cliente: ${clave_cliente}

Recalcula el nivel de riesgo MVE considerando:
1. ¿Esto retrasa la presentación del formato E2?
2. ¿Cuál es la nueva fecha estimada de cumplimiento?
3. ¿Hay riesgo de multa ($4,790-$7,190 MXN por operación)?

Responde en formato:
RIESGO: [ALTO/MEDIO/BAJO]
FECHA_LIMITE: [YYYY-MM-DD]
ACCION: [qué hacer]`,
    { module: 'mve-predictor', temperature: 0.2, validate: true }
  );

  // Parse risk level from output
  const riskMatch = output?.match(/RIESGO:\s*(ALTO|MEDIO|BAJO)/i);
  const risk = riskMatch ? riskMatch[1].toLowerCase() : 'desconocido';

  return { action: 'risk_recalculated', risk, analysis: output, confidence };
}

/**
 * Handler: Client Comms — notifies client of delays/issues
 */
async function handleClientComms(payload) {
  const { event_type, trafico, details, clave_cliente } = payload;

  const { output, confidence } = await callQwen(
    `Eres el comunicador profesional de Renato Zapata & Company, agencia aduanal en Laredo.

Necesitas notificar al cliente sobre un evento:
- Tipo: ${event_type}
- Tráfico: ${trafico}
- Detalles: ${JSON.stringify(details)}

Redacta una notificación profesional en español que sea:
1. Clara y directa
2. Incluya el impacto en tiempos
3. Incluya la acción que YA estamos tomando
4. Mantenga la confianza del cliente

Formato: Mensaje corto para Telegram/WhatsApp (máximo 200 palabras).`,
    { module: 'client-comms', temperature: 0.3 }
  );

  return { action: 'notification_drafted', message: output, confidence };
}

/**
 * Handler: Trade Lane Optimizer — recalculates best route
 */
async function handleTradeLaneOptimizer(payload) {
  const { bridge_affected, delay_minutes, trafico } = payload;

  const { output, confidence } = await callQwen(
    `Eres el optimizador de rutas en la frontera Laredo-Nuevo Laredo.

Se reportó un retraso:
- Puente afectado: ${bridge_affected}
- Retraso: ${delay_minutes} minutos
- Tráfico: ${trafico}

Puentes disponibles:
1. World Trade Bridge (comercial, principal)
2. Colombia Bridge (comercial, alternativa)
3. Laredo-Nuevo Laredo Bridge 1 (mixto)

Recomienda:
1. ¿Cuál puente usar ahora?
2. ¿Cuánto tiempo se ahorra?
3. ¿Hay ventana óptima en las próximas 4 horas?`,
    { module: 'trade-lane-optimizer', temperature: 0.2 }
  );

  return { action: 'route_recalculated', recommendation: output, confidence };
}

/**
 * Handler: Meta-Learner — learns from corrections
 */
async function handleMetaLearner(payload) {
  const { module_name, original, corrected, context } = payload;

  const { output } = await callQwen(
    `Eres el meta-aprendiz del sistema CRUZ. Analiza esta corrección humana:

Módulo: ${module_name}
Original: ${JSON.stringify(original)}
Corregido: ${JSON.stringify(corrected)}
Contexto: ${JSON.stringify(context)}

Genera UNA regla específica que este módulo debe seguir para evitar este error.
La regla debe ser:
- Concreta (no genérica)
- Aplicable automáticamente
- En español
- Máximo 2 oraciones

Formato: REGLA: [tu regla aquí]`,
    { module: 'meta-learner', temperature: 0.2, injectImprovements: false }
  );

  // Extract rule and save as prompt improvement
  const ruleMatch = output?.match(/REGLA:\s*(.+)/i);
  if (ruleMatch) {
    await supabase.from('prompt_improvements').insert({
      module_name,
      improvement_text: ruleMatch[1].trim(),
      priority: 1,
      active: true,
    });
  }

  return { action: 'rule_generated', rule: ruleMatch?.[1] || output };
}

/**
 * Handler: Telegram Notifier — sends message via cruz-bot
 */
async function handleTelegramNotify(payload) {
  const { message, chat_id, priority } = payload;

  // Call the existing cruz-bot's send function
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const targetChat = chat_id || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !targetChat) {
      return { action: 'telegram_skipped', reason: 'no credentials' };
    }

    const prefix = priority === 'critical' ? '🔴 URGENTE' :
                   priority === 'high' ? '🟡 ATENCIÓN' : '🔵 INFO';

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text: `${prefix}\n\n${message}`,
        parse_mode: 'HTML',
      })
    });

    return { action: 'telegram_sent', success: res.ok };
  } catch (err) {
    return { action: 'telegram_failed', error: err.message };
  }
}

// ============================================================================
// SUBSCRIPTION MAP — event_type -> [handler functions]
// ============================================================================

const SUBSCRIPTIONS = {
  // Document lifecycle events
  'missing_document': [
    { name: 'supplier-negotiator', handler: handleSupplierNegotiator },
    { name: 'deadline-calendar', handler: handleDeadlineCalendar },
    { name: 'mve-predictor', handler: handleMVEPredictor },
  ],

  // Risk events
  'risk_alert': [
    { name: 'deadline-calendar', handler: handleDeadlineCalendar },
    { name: 'client-comms', handler: handleClientComms },
    { name: 'telegram-notify', handler: handleTelegramNotify },
  ],

  // Border/crossing events
  'border_delay': [
    { name: 'trade-lane-optimizer', handler: handleTradeLaneOptimizer },
    { name: 'client-comms', handler: handleClientComms },
    { name: 'telegram-notify', handler: handleTelegramNotify },
  ],

  // Human correction events
  'correction_made': [
    { name: 'meta-learner', handler: handleMetaLearner },
  ],

  // Classification events
  'classification_change': [
    { name: 'mve-predictor', handler: handleMVEPredictor },
    { name: 'client-comms', handler: handleClientComms },
  ],

  // Deadline events
  'deadline_approaching': [
    { name: 'telegram-notify', handler: handleTelegramNotify },
    { name: 'client-comms', handler: handleClientComms },
  ],

  // Inspection events
  'inspection_predicted': [
    { name: 'telegram-notify', handler: handleTelegramNotify },
    { name: 'client-comms', handler: handleClientComms },
  ],
};

// ============================================================================
// CORE EVENT FUNCTIONS
// ============================================================================

/**
 * Emit an event — saves to DB and triggers all subscribers
 * 
 * @param {string} eventType - Event type (must be in SUBSCRIPTIONS)
 * @param {string} sourceModule - Which module emitted this
 * @param {Object} payload - Event data
 * @param {number} priority - 0=normal, 1=high, 2=critical
 * @returns {Object} Results from all triggered handlers
 */
async function emitEvent(eventType, sourceModule, payload, priority = 0) {
  const subscribers = SUBSCRIPTIONS[eventType];
  if (!subscribers) {
    console.warn(`⚠ Unknown event type: ${eventType}`);
    return { error: `Unknown event type: ${eventType}` };
  }

  const targetModules = subscribers.map(s => s.name);

  // Save event
  const { data: event } = await supabase
    .from('cruz_events')
    .insert({
      event_type: eventType,
      source_module: sourceModule,
      target_modules: targetModules,
      payload,
      priority,
      processed: false,
    })
    .select()
    .single();

  console.log(`📡 [${eventType}] from ${sourceModule} → ${targetModules.join(', ')}`);

  // Process all subscribers
  const results = {};
  const processedBy = [];
  const errors = {};

  for (const sub of subscribers) {
    try {
      console.log(`  → ${sub.name}...`);
      const result = await sub.handler({ ...payload, event_type: eventType });
      results[sub.name] = result;
      processedBy.push(sub.name);
      console.log(`  ✅ ${sub.name}: ${result.action}`);
    } catch (err) {
      errors[sub.name] = err.message;
      console.error(`  ❌ ${sub.name}: ${err.message}`);
    }
  }

  // Mark event as processed
  if (event?.id) {
    await supabase
      .from('cruz_events')
      .update({
        processed: true,
        processed_by: processedBy,
        error_log: Object.keys(errors).length ? errors : null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  }

  return { eventId: event?.id, results, errors };
}

/**
 * Process any unprocessed events (cron fallback)
 * Run this every minute via cron or as a PM2 process
 */
async function processPendingEvents() {
  const { data: events } = await supabase
    .from('cruz_events')
    .select('*')
    .eq('processed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);

  if (!events?.length) return 0;

  console.log(`📬 Processing ${events.length} pending events...`);

  for (const event of events) {
    const subscribers = SUBSCRIPTIONS[event.event_type] || [];
    const alreadyProcessed = event.processed_by || [];
    const remaining = subscribers.filter(s => !alreadyProcessed.includes(s.name));

    if (!remaining.length) {
      await supabase.from('cruz_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', event.id);
      continue;
    }

    for (const sub of remaining) {
      try {
        await sub.handler({ ...event.payload, event_type: event.event_type });
        alreadyProcessed.push(sub.name);
      } catch (err) {
        console.error(`❌ ${sub.name} failed for event ${event.id}: ${err.message}`);
      }
    }

    await supabase.from('cruz_events').update({
      processed: true,
      processed_by: alreadyProcessed,
      processed_at: new Date().toISOString(),
    }).eq('id', event.id);
  }

  return events.length;
}

// ============================================================================
// DAEMON MODE — run with: node event-bus.js --daemon
// ============================================================================

if (require.main === module) {
  const isDaemon = process.argv.includes('--daemon');

  if (isDaemon) {
    console.log('🚀 CRUZ Event Bus — Daemon Mode');
    console.log(`   Subscriptions: ${Object.keys(SUBSCRIPTIONS).length} event types`);
    console.log(`   Checking every 30 seconds...\n`);

    setInterval(async () => {
      try {
        const count = await processPendingEvents();
        if (count > 0) console.log(`   Processed ${count} events`);
      } catch (err) {
        console.error('Event bus error:', err.message);
      }
    }, 30 * 1000);

    // Initial run
    processPendingEvents().catch(console.error);
  } else {
    // Test mode — emit a test event
    console.log('🧪 CRUZ Event Bus — Test Mode');
    emitEvent('missing_document', 'test', {
      document_type: 'Factura comercial',
      trafico: '9254-Y4466',
      supplier: 'RR Donnelley',
      clave_cliente: '9254',
    }).then(result => {
      console.log('\nResults:', JSON.stringify(result, null, 2));
    }).catch(console.error);
  }
}

module.exports = { emitEvent, processPendingEvents, SUBSCRIPTIONS };
