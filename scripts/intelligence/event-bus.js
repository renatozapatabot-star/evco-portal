#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUBSCRIPTIONS = {
  'missing_document': ['supplier-negotiator', 'deadline-calendar', 'mve-predictor'],
  'risk_alert': ['deadline-calendar'],
  'border_delay': ['trade-lane-optimizer']
};

async function emitEvent(eventType, sourceModule, payload) {
  const event = {
    event_type: eventType,
    source_module: sourceModule,
    payload: payload,
    processed: false,
    created_at: new Date().toISOString()
  };
  
  const { data } = await supabase.from('cruz_events').insert(event).select();
  console.log(`📡 Event emitted: ${eventType} from ${sourceModule}`);
  
  const subscribers = SUBSCRIPTIONS[eventType] || [];
  for (const subscriber of subscribers) {
    console.log(`  → Would trigger ${subscriber}`);
  }
  
  return data;
}

async function processPendingEvents() {
  const { data: events } = await supabase
    .from('cruz_events')
    .select('*')
    .eq('processed', false)
    .limit(10);
  
  for (const event of events) {
    await supabase.from('cruz_events').update({ processed: true }).eq('id', event.id);
  }
}

if (require.main === module) {
  console.log('🚀 CRUZ Event Bus running...');
  setInterval(processPendingEvents, 60 * 1000);
}

module.exports = { emitEvent, processPendingEvents };
