const { google } = require('googleapis')
const http = require('http'); const url = require('url'); const fs = require('fs'); const path = require('path')
require('dotenv').config({ path: '.env.local' })
const CLIENT_ID = process.env.GMAIL_CLIENT_ID; const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('❌ GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET not found in .env.local\n')
  console.log('SETUP INSTRUCTIONS:\n1. Go to console.cloud.google.com\n2. Create project "CRUZ-Gmail"\n3. Enable Gmail API + Calendar API\n4. Create OAuth 2.0 Client ID (Desktop app)\n5. Add to .env.local:\n   GMAIL_CLIENT_ID=your-id\n   GMAIL_CLIENT_SECRET=your-secret\n6. Run this script again')
  process.exit(0)
}

const REDIRECT = 'http://localhost:3333/oauth2callback'
const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT)
const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'], prompt: 'consent' })

console.log('🔐 Gmail OAuth2 Setup\nOpen this URL:\n\n' + authUrl + '\n')
try { require('child_process').execSync(`open "${authUrl}"`) } catch {}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true)
  if (parsed.pathname === '/oauth2callback' && parsed.query.code) {
    try {
      const { tokens } = await oauth2.getToken(parsed.query.code)
      console.log('\n✅ Success!\nGMAIL_REFRESH_TOKEN=' + tokens.refresh_token)
      const envPath = path.join(process.cwd(), '.env.local'); let env = fs.readFileSync(envPath, 'utf8')
      if (!env.includes('GMAIL_REFRESH_TOKEN')) fs.appendFileSync(envPath, '\nGMAIL_REFRESH_TOKEN=' + tokens.refresh_token)
      else { env = env.replace(/GMAIL_REFRESH_TOKEN=.*/, 'GMAIL_REFRESH_TOKEN=' + tokens.refresh_token); fs.writeFileSync(envPath, env) }
      console.log('✅ Saved to .env.local\nNext: vercel env add GMAIL_REFRESH_TOKEN production')
      res.end('<h1>✅ Done! Return to terminal.</h1>'); setTimeout(() => { server.close(); process.exit(0) }, 2000)
    } catch (e) { console.error('Error:', e.message); res.end('Error: ' + e.message) }
  }
})
server.listen(3333, () => console.log('Waiting for authorization on port 3333...'))
