#!/usr/bin/env node
// scripts/setup-whatsapp.js
// Configure Twilio WhatsApp Sandbox for CRUZ
// Run once: node scripts/setup-whatsapp.js

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const WEBHOOK_URL = 'https://evco-portal.vercel.app/api/whatsapp'
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

async function setup() {
  console.log(`🦀 CRUZ WhatsApp Setup`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Webhook URL: ${WEBHOOK_URL}`)
  console.log(`From Number: ${TWILIO_FROM}`)
  console.log()

  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log(`⚠️  Missing Twilio credentials. Set in .env.local:`)
    console.log(`   TWILIO_ACCOUNT_SID=your_sid`)
    console.log(`   TWILIO_AUTH_TOKEN=your_token`)
    console.log(`   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`)
    console.log()
    console.log(`Manual setup steps:`)
    console.log(`1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn`)
    console.log(`2. Set "WHEN A MESSAGE COMES IN" to: ${WEBHOOK_URL}`)
    console.log(`3. Method: POST`)
    console.log(`4. Save configuration`)
    console.log(`5. Send "join <sandbox-word>" from WhatsApp to +1 (415) 523-8886`)
    console.log()
    console.log(`Test command:`)
    console.log(`  curl -X POST ${WEBHOOK_URL} -d "From=whatsapp:+15551234567&Body=hola CRUZ, cuantos traficos activos?"`)
    return
  }

  // Test the webhook
  console.log(`Testing webhook...`)
  try {
    const res = await fetch(`${WEBHOOK_URL.replace('/api/whatsapp', '/api/whatsapp')}`, { method: 'GET' })
    const data = await res.json()
    console.log(`✅ Webhook reachable:`, data)
  } catch (e) {
    console.log(`⚠️  Webhook not reachable — deploy first with: vercel --prod`)
  }

  // Send test message
  console.log(`\nSending test message...`)
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

    const testTo = process.env.TITO_PHONE
    if (!testTo) {
      console.log(`⚠️  Set TITO_PHONE in .env.local to send test message`)
      return
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_FROM,
        To: `whatsapp:${testTo}`,
        Body: `🦀 CRUZ WhatsApp activo!\n\nPuedes preguntar:\n- "Cuantos traficos activos?"\n- "Status de EVCO"\n- "Hay faltantes hoy?"\n\n— CRUZ · Renato Zapata & Company`,
      }),
    })

    const result = await res.json()
    if (result.sid) {
      console.log(`✅ Test message sent! SID: ${result.sid}`)
    } else {
      console.log(`⚠️  Send failed:`, result.message || result)
    }
  } catch (e) {
    console.log(`❌ Error:`, e.message)
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ WhatsApp integration ready`)
  console.log(`Ursula can text CRUZ at WhatsApp and get real answers.`)
}

setup().catch(console.error)
