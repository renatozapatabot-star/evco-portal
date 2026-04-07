// scripts/lib/push-sender.js
// ============================================================================
// Web Push Notification Sender — shared module
//
// Reads push subscriptions from Supabase, sends via VAPID.
// Cleans up expired subscriptions (HTTP 410).
//
// Required env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ============================================================================

let webpush

try {
  webpush = require('web-push')
} catch {
  // web-push not installed — provide a no-op with warning
  module.exports = {
    sendPushToCompany: async () => {
      console.warn('[push] web-push not installed. Run: npm install web-push')
    },
  }
  return
}

const { createClient } = require('@supabase/supabase-js')

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function configure() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:ai@renatozapata.com'

  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys not configured. Generate with: npx web-push generate-vapid-keys')
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

/**
 * Send a push notification to all subscribers for a company.
 * @param {string} companyId - company_id to target
 * @param {{ title: string, body: string, url?: string }} payload - notification content
 */
async function sendPushToCompany(companyId, payload) {
  if (!configure()) return

  const supabase = getSupabase()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, auth, p256dh')
    .eq('company_id', companyId)

  if (error || !subs?.length) {
    if (error) console.error('[push] Error fetching subscriptions:', error.message)
    return
  }

  let sent = 0
  let cleaned = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          icon: '/icon-192.png',
        })
      )
      sent++
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — clean up
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        cleaned++
      } else {
        console.error(`[push] Failed to send to ${sub.endpoint.slice(0, 50)}...:`, err.message)
      }
    }
  }

  console.log(`[push] ${companyId}: sent=${sent}, cleaned=${cleaned}, total=${subs.length}`)
}

module.exports = { sendPushToCompany }
