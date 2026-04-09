#!/usr/bin/env node
// scripts/test-signup-mode.js
// Verify getSignupMode() JSONB parse works correctly against real DB
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

;(async () => {
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await sb.from('system_config').select('value').eq('key', 'signup_mode').maybeSingle()

  if (error) { console.error('DB error:', error.message); process.exit(1) }
  if (!data) { console.log('No signup_mode row — default gated'); process.exit(0) }

  let raw = data.value
  console.log('Raw value:', JSON.stringify(raw))
  console.log('typeof:', typeof raw)

  if (typeof raw === 'string') {
    if (raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1)
      console.log('Stripped quotes →', raw)
    }
  }

  const valid = raw === 'self_service' || raw === 'gated'
  console.log('Parsed mode:', raw)
  console.log('Is valid:', valid)
  process.exit(valid ? 0 : 1)
})()
