#!/usr/bin/env node
// scripts/test-notification.js
// ============================================================================
// Inserts a test notification_events row and runs send-notifications.js
// to verify end-to-end email delivery via Resend.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Until renatozapata.com is verified in Resend, test emails can only go to the account owner
const TEST_EMAIL = 'ai@renatozapata.com'

async function main() {
  console.log('[test-notification] Inserting test notification_events row...')

  const { data, error } = await supabase
    .from('notification_events')
    .insert({
      event_type: 'entrada_created',
      template_key: 'entrada_created',
      recipient_email: TEST_EMAIL,
      subject: 'Solicitud Recibida \u2014 TEST-2026-001',
      status: 'pending',
      template_vars: {
        trafico_number: 'TEST-2026-001',
        descripcion_mercancia: 'Resina de polietileno de alta densidad',
        valor_estimado: '$42,500 USD',
      },
    })
    .select()
    .single()

  if (error) {
    console.error('[test-notification] Insert failed:', error.message)
    process.exit(1)
  }

  console.log(`[test-notification] Inserted row id=${data.id}, template=entrada_created`)
  console.log(`[test-notification] Recipient: ${TEST_EMAIL}`)
  console.log('[test-notification] Running send-notifications.js...\n')

  try {
    execSync(`node ${path.join(__dirname, 'send-notifications.js')}`, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log('\n[test-notification] Done. Check inbox for test email.')
  } catch (err) {
    console.error('\n[test-notification] send-notifications.js exited with error')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[test-notification] Fatal:', err.message)
  process.exit(1)
})
