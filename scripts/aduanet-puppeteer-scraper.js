#!/usr/bin/env node
/**
 * ADUANET Puppeteer Scraper
 * Logs in to aduanetm3.net, pulls recent pedimentos
 * Based on evco-ops aduanet-scraper.js (Playwright → Puppeteer)
 * Run: node scripts/aduanet-puppeteer-scraper.js [--days=30]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const puppeteer = require('puppeteer')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADUANET_URL = 'https://www.aduanetm3.net/loginI.php'
const USUARIO = process.env.ADUANET_USER || 'CONTARZ8402'
const PASSWORD = process.env.ADUANET_PASSWORD || 'CRZ8402'
const IDRA = process.env.ADUANET_IDRA || 'RZGA01'
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
const DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '30')

async function tg(msg) {
  if (!TG) { console.log('[TG]', msg); return }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function run() {
  console.log('\n📋 ADUANET PUPPETEER SCRAPER')
  console.log(`Pulling last ${DAYS} days of pedimentos`)
  console.log('═'.repeat(40))

  let browser
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')

    // Step 1: Navigate to login
    console.log('Navigating to ADUANET...')
    await page.goto(ADUANET_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.screenshot({ path: '/tmp/aduanet-01-landing.png' })

    const title = await page.title()
    console.log('Page title:', title)

    // Debug: confirm .env.local loaded
    console.log(`Credentials: USER=${USUARIO.slice(0, 4)}*** PWD=${'*'.repeat(PASSWORD.length)} IDRA=${IDRA}`)

    // Debug: dump form fields
    const formFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select')).map(el => ({
        tag: el.tagName, name: el.name, type: el.type, id: el.id
      }))
    })
    console.log('Form fields found:', JSON.stringify(formFields, null, 2))

    // Step 2: Fill login form
    // Actual ADUANET form fields: Usr, Pwd, Uscom
    const userSelectors = ['input[name="Usr"]', 'input[name="usr"]', 'input[name="usuario"]', 'input[name="USUARIO"]', 'input[type="text"]']
    const passSelectors = ['input[name="Pwd"]', 'input[name="pwd"]', 'input[name="password"]', 'input[name="PASSWORD"]', 'input[type="password"]']
    const idraSelectors = ['input[name="Uscom"]', 'input[name="uscom"]', 'input[name="idra"]', 'input[name="IDRA"]', 'select[name="Uscom"]', 'select[name="idra"]']

    for (const sel of userSelectors) {
      try {
        const el = await page.$(sel)
        if (el) { await el.type(USUARIO); console.log('Filled user:', sel); break }
      } catch {}
    }

    for (const sel of passSelectors) {
      try {
        const el = await page.$(sel)
        if (el) { await el.type(PASSWORD); console.log('Filled pass:', sel); break }
      } catch {}
    }

    for (const sel of idraSelectors) {
      try {
        const el = await page.$(sel)
        if (el) { await el.type(IDRA); console.log('Filled IDRA:', sel); break }
      } catch {}
    }

    await page.screenshot({ path: '/tmp/aduanet-02-filled.png' })

    // Step 3: Submit
    console.log('Submitting login...')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.click('input[type="submit"], button[type="submit"]').catch(() => {
        // Try pressing Enter
        page.keyboard.press('Enter')
      })
    ])

    await page.screenshot({ path: '/tmp/aduanet-03-after-login.png' })
    const afterLoginUrl = page.url()
    console.log('After login URL:', afterLoginUrl)

    // Check if logged in
    const bodyText = await page.evaluate(() => document.body.innerText)
    const loggedIn = bodyText.includes('MENU') || bodyText.includes('menu') ||
      bodyText.includes('Consulta') || bodyText.includes('consulta') ||
      afterLoginUrl.includes('menu') || afterLoginUrl.includes('principal')

    if (!loggedIn) {
      console.log('Login may have failed. Page content (first 500 chars):')
      console.log(bodyText.substring(0, 500))
      await tg(`⚠️ ADUANET login may have failed\nURL: ${afterLoginUrl}\n— CRUZ 🦀`)

      // Save screenshots for debugging
      console.log('Screenshots saved to /tmp/aduanet-*.png')
      await browser.close()
      return
    }

    console.log('✅ Logged in to ADUANET')
    await tg(`📋 <b>ADUANET conectado</b>\nBuscando pedimentos últimos ${DAYS} días\n— CRUZ 🦀`)

    // Step 4: Navigate to pedimentos/consulta
    // This depends on the actual menu structure
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      }))
    })
    console.log('Available links:', links.slice(0, 20).map(l => `${l.text}: ${l.href}`).join('\n'))

    // Look for pedimento/consulta links
    const pedimentoLink = links.find(l =>
      l.text.toLowerCase().includes('pedimento') ||
      l.text.toLowerCase().includes('consulta') ||
      l.href.includes('pedimento') ||
      l.href.includes('consulta')
    )

    if (pedimentoLink) {
      console.log('Found pedimento link:', pedimentoLink.text, pedimentoLink.href)
      await page.goto(pedimentoLink.href, { waitUntil: 'networkidle2', timeout: 15000 })
      await page.screenshot({ path: '/tmp/aduanet-04-pedimentos.png' })

      // Extract any pedimento data visible
      const pageData = await page.evaluate(() => document.body.innerText)
      console.log('Pedimento page (first 1000 chars):', pageData.substring(0, 1000))

      // Look for table data
      const tables = await page.evaluate(() => {
        const rows = []
        document.querySelectorAll('table tr').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
          if (cells.length > 2) rows.push(cells)
        })
        return rows
      })
      console.log(`Found ${tables.length} table rows`)
      tables.slice(0, 5).forEach(r => console.log('  ', r.join(' | ')))
    } else {
      console.log('No pedimento link found. Available:', links.map(l => l.text).join(', '))
    }

    await browser.close()
    console.log('\n✅ Scraper complete')
    console.log('Check /tmp/aduanet-*.png for screenshots')

  } catch (e) {
    console.error('Scraper error:', e.message)
    await tg(`❌ ADUANET scraper error: ${e.message}\n— CRUZ 🦀`)
    if (browser) await browser.close()
  }

  // Log scrape run
  await supabase.from('scrape_runs').insert({
    source: 'aduanet_puppeteer',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: 'success',
    metadata: { days: DAYS }
  })
}

run().catch(console.error)
