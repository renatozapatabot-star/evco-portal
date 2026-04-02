const { execSync } = require('child_process')
const today = new Date().toISOString().split('T')[0]

function check(name, logPath) {
  try {
    const out = execSync(`grep "${today}" ${logPath} 2>/dev/null | grep -i "error\\|fail" | tail -3`, { encoding: 'utf8', timeout: 5000 })
    if (out.trim()) {
      console.log(`--- ${name} ---`)
      console.log(out.trim())
      console.log('')
    }
  } catch(e) {}
}

console.log("=== TODAY'S ERRORS (" + today + ") ===\n")
check('heartbeat', '/tmp/heartbeat.log')
check('integration-health', '/tmp/integration-health.log')
check('bridge-times', '/tmp/bridge-times.log')
check('email-intake', '/tmp/email-intake.log')
check('send-notifications', '/tmp/send-notifications.log')
check('draft-escalation', '/tmp/draft-escalation.log')
check('cbp-wait', '/tmp/cbp-wait.log')

// globalpc-sync pm2 errors
try {
  const gpc = execSync('tail -5 ~/.pm2/logs/globalpc-sync-error.log 2>/dev/null', { encoding: 'utf8' })
  if (gpc.trim()) {
    console.log('--- globalpc-sync (pm2) ---')
    console.log(gpc.trim())
    console.log('')
  }
} catch(e) {}

// Last email-intake run
try {
  const ei = execSync('tail -15 /tmp/email-intake.log 2>/dev/null', { encoding: 'utf8' })
  console.log('--- email-intake (last run) ---')
  console.log(ei.trim())
} catch(e) {}
