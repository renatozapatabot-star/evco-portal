#!/usr/bin/env node
/**
 * aduanet-scraper-v2.js — ADUANET Puppeteer scraper with proper login flow
 * Login: loginI.php → login_auth.php → loginV.php (verified session)
 * Then: extract pedimentos from consulta and upsert to aduanet_facturas
 *
 * Run: node scripts/aduanet-scraper-v2.js [--days=30] [--headed]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const puppeteer = require('puppeteer')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BASE_URL = 'http://www.aduanetm3.net'
const USUARIO = process.env.ADUANET_USER || 'CONTARZ8402'
const PASSWORD = process.env.ADUANET_PASSWORD || 'CRZ8402'
const IDRA = process.env.ADUANET_IDRA || 'RZGA01'
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
const DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '30')
const HEADED = process.argv.includes('--headed')
const COMPANY_ID = 'evco'

async function tg(msg) {
  if (!TG) { console.log('[TG]', msg); return }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function screenshot(page, name) {
  try {
    await page.screenshot({ path: `/tmp/aduanet-v2-${name}.png`, fullPage: true })
  } catch (e) {
    console.log(`  ⚠ Screenshot ${name} failed: ${e.message.split('.')[0]}`)
  }
}

// ── Login Flow ──
// Observed auth chain: loginI.php → POST login_auth.php → JS navigates to herramientas/home.php
// The form submit sets session cookies. After that, navigating directly to home.php works.
// Puppeteer loses track of the JS-driven navigation, so we navigate manually after auth.
async function login(page, browser) {
  console.log('Step 1: Navigate to loginI.php')
  await page.goto(`${BASE_URL}/loginI.php`, { waitUntil: 'networkidle2', timeout: 30000 })
  await screenshot(page, '01-loginI')

  console.log(`  Credentials: USER=${USUARIO.slice(0, 4)}*** IDRA=${IDRA}`)

  // Fill all 3 fields with character-by-character typing
  await page.click('input[name="Usr"]', { clickCount: 3 })
  await page.type('input[name="Usr"]', USUARIO, { delay: 30 })
  await page.click('input[name="Pwd"]', { clickCount: 3 })
  await page.type('input[name="Pwd"]', PASSWORD, { delay: 30 })
  await page.click('input[name="Uscom"]', { clickCount: 3 })
  await page.type('input[name="Uscom"]', IDRA, { delay: 30 })

  // Verify
  const vals = await page.evaluate(() => ({
    u: document.getElementById('Usr')?.value,
    p: document.getElementById('Pwd')?.value?.length,
    i: document.getElementById('Uscom')?.value
  }))
  console.log(`  Verify: Usr=${vals.u?.slice(0,4)}*** Pwd=${vals.p}chars Uscom=${vals.i}`)
  await screenshot(page, '02-filled')

  // Submit by clicking ENTRAR button (includes go=ENTRAR in POST data, unlike form.submit())
  console.log('Step 2: Click ENTRAR')
  await page.click('input[name="go"]')

  // Wait for login_auth.php to process (loads JS → AJAX → redirect to home.php)
  await new Promise(r => setTimeout(r, 8000))
  console.log(`  After submit: ${page.url()}`)

  // The session cookies are now set. Navigate directly to home.php
  console.log('Step 3: Navigate to home.php with session cookies')
  await page.goto(`${BASE_URL}/herramientas/home.php`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 2000))
  await screenshot(page, '03-home')

  const homeUrl = page.url()
  console.log(`  Home URL: ${homeUrl}`)

  // Check if we landed on the dashboard or got redirected back to login
  const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
  const title = await page.title().catch(() => '')
  console.log(`  Title: "${title}"`)
  console.log(`  Body (first 200): ${bodyText.substring(0, 200)}`)

  if (homeUrl.includes('loginI') || title.toLowerCase().includes('login')) {
    // Session didn't take — try login via the two-step flow
    console.log('  ⚠ Session not set — trying step 2 login...')

    // The page is on loginI.php?i=RZGA01 — fill user+password, Uscom is pre-filled
    await page.click('input[name="Usr"]', { clickCount: 3 })
    await page.type('input[name="Usr"]', USUARIO, { delay: 30 })
    await page.click('input[name="Pwd"]', { clickCount: 3 })
    await page.type('input[name="Pwd"]', PASSWORD, { delay: 30 })

    await page.click('input[name="go"]')
    await new Promise(r => setTimeout(r, 8000))

    // Try home.php again
    await page.goto(`${BASE_URL}/herramientas/home.php`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 2000))

    const retryUrl = page.url()
    console.log(`  Retry URL: ${retryUrl}`)
    if (retryUrl.includes('loginI')) {
      throw new Error('Login failed after retry — check credentials')
    }
  }

  console.log('✅ Login successful')
  return page
}

// ── Extract pedimentos from consulta page ──
async function extractPedimentos(page) {
  console.log('\n── Extracting pedimentos ──')

  // ADUANET uses framesets — explore frames first
  const frames = page.frames()
  console.log(`Page has ${frames.length} frame(s)`)
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    console.log(`  Frame ${i}: ${f.url()} name="${f.name()}"`)
    try {
      const frameLinks = await f.evaluate(() =>
        Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.innerText.trim(), href: a.href
        }))
      )
      if (frameLinks.length > 0) {
        console.log(`    Links: ${frameLinks.slice(0, 10).map(l => `"${l.text}" → ${l.href}`).join('\n    ')}`)
      }
      const frameText = await f.evaluate(() => document.body?.innerText?.substring(0, 200) || '')
      if (frameText.trim()) {
        console.log(`    Text: ${frameText.trim().substring(0, 150)}`)
      }
    } catch (e) {
      console.log(`    (could not read frame: ${e.message.split('.')[0]})`)
    }
  }

  // Collect links from all frames
  let allLinks = []
  for (const f of frames) {
    try {
      const frameLinks = await f.evaluate(() =>
        Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.innerText.trim().toLowerCase(),
          href: a.href
        }))
      )
      allLinks.push(...frameLinks)
    } catch {}
  }

  // Also get links from main page
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText.trim().toLowerCase(),
      href: a.href
    }))
  )
  allLinks.push(...links)

  console.log(`Total links found (all frames + main): ${allLinks.length}`)

  // Look for consulta or pedimento links
  const targets = [
    'consulta de pedimentos', 'consulta pedimentos', 'pedimentos',
    'consultas', 'consulta', 'estado de cuenta'
  ]

  let targetLink = null
  for (const term of targets) {
    targetLink = allLinks.find(l => l.text.includes(term) || l.href.toLowerCase().includes(term.replace(/ /g, '')))
    if (targetLink) break
  }

  if (!targetLink) {
    targetLink = allLinks.find(l =>
      l.href.includes('pedimento') || l.href.includes('consulta') ||
      l.href.includes('estado') || l.href.includes('reporte')
    )
  }

  if (!targetLink) {
    console.log('Available links:', allLinks.slice(0, 30).map(l => `"${l.text}" → ${l.href}`).join('\n'))
    await tg(`⚠️ <b>ADUANET</b>: No pedimento link found\nAvailable: ${allLinks.slice(0, 10).map(l => l.text).join(', ')}\n— CRUZ 🦀`)
    return []
  }

  console.log(`Found: "${targetLink.text}" → ${targetLink.href}`)
  await page.goto(targetLink.href, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 3000))
  await screenshot(page, '06-consulta')

  // Log page structure (frames, content)
  console.log(`Pedimentos page URL: ${page.url()}`)
  const pedFrames = page.frames()
  console.log(`Pedimentos page has ${pedFrames.length} frame(s)`)
  for (let i = 0; i < pedFrames.length; i++) {
    const f = pedFrames[i]
    console.log(`  Frame ${i}: ${f.url()} name="${f.name()}"`)
    try {
      const text = await f.evaluate(() => document.body?.innerText?.substring(0, 300) || '')
      if (text.trim()) console.log(`    Content: ${text.trim().substring(0, 200)}`)
      const formCount = await f.evaluate(() => document.querySelectorAll('form').length)
      const tableCount = await f.evaluate(() => document.querySelectorAll('table').length)
      const inputCount = await f.evaluate(() => document.querySelectorAll('input').length)
      console.log(`    Forms: ${formCount}, Tables: ${tableCount}, Inputs: ${inputCount}`)
    } catch (e) {
      console.log(`    (frame unreadable)`)
    }
  }

  // Try to find the right frame with forms or tables
  let workFrame = null
  for (const f of pedFrames) {
    try {
      const hasForm = await f.evaluate(() => document.querySelectorAll('form').length > 0)
      const hasTable = await f.evaluate(() => document.querySelectorAll('table tr').length > 2)
      if (hasForm || hasTable) {
        workFrame = f
        console.log(`Using frame: ${f.url()}`)
        break
      }
    } catch {}
  }

  // Fallback to main page if no frame has content
  const target = workFrame || page

  // Fill date range if there's a form
  const dateFrom = await target.$('input[name*="fecha_ini"], input[name*="desde"], input[name*="inicio"]')
  if (dateFrom) {
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - DAYS)
    const fromStr = fromDate.toISOString().split('T')[0].split('-').reverse().join('/')
    await dateFrom.click({ clickCount: 3 })
    await dateFrom.type(fromStr)
    console.log(`  Date from: ${fromStr}`)

    // Submit the search
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      target.evaluate(() => {
        const btn = document.querySelector('input[type="submit"], button[type="submit"], input[value*="Buscar"], input[value*="Consultar"]')
        if (btn) btn.click()
        else document.querySelector('form')?.submit()
      })
    ])
    await new Promise(r => setTimeout(r, 2000))
    await screenshot(page, '07-results')
  }

  // Extract table data from target frame and all frames
  let tableData = []
  const extractFrom = async (ctx, label) => {
    try {
      const rows = await ctx.evaluate(() => {
        const r = []
        document.querySelectorAll('table tr').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim())
          if (cells.length >= 3) r.push(cells)
        })
        return r
      })
      if (rows.length > 0) {
        console.log(`  ${label}: ${rows.length} table rows`)
        tableData.push(...rows)
      }
    } catch {}
  }

  await extractFrom(page, 'Main page')
  for (let i = 0; i < pedFrames.length; i++) {
    await extractFrom(pedFrames[i], `Frame ${i}`)
  }

  console.log(`Total table rows found: ${tableData.length}`)
  if (tableData.length > 0) {
    console.log('Headers:', tableData[0].join(' | '))
    tableData.slice(1, 4).forEach(r => console.log('  ', r.join(' | ')))
  }

  return tableData
}

// ── Parse table rows into pedimento records ──
function parseTableRows(rows) {
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  const pedIdx = headers.findIndex(h => h.includes('pedimento'))
  const refIdx = headers.findIndex(h => h.includes('referencia'))
  const fechaIdx = headers.findIndex(h => h.includes('fecha'))
  const valorIdx = headers.findIndex(h => h.includes('valor') || h.includes('importe'))
  const igiIdx = headers.findIndex(h => h.includes('igi') || h.includes('arancel'))

  const records = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const pedimento = pedIdx >= 0 ? r[pedIdx] : null
    if (!pedimento || pedimento.length < 5) continue

    records.push({
      pedimento: pedimento,
      referencia: refIdx >= 0 ? r[refIdx] : null,
      fecha_pago: fechaIdx >= 0 ? parseDate(r[fechaIdx]) : null,
      valor_usd: valorIdx >= 0 ? parseNumber(r[valorIdx]) : null,
      igi: igiIdx >= 0 ? parseNumber(r[igiIdx]) : null,
      clave_cliente: '9254',  // EVCO-specific — not a multi-client pattern
      company_id: COMPANY_ID,
      updated_at: new Date().toISOString(),
    })
  }
  return records
}

function parseDate(s) {
  if (!s) return null
  // Handle DD/MM/YYYY or YYYY-MM-DD
  const parts = s.split(/[/-]/)
  if (parts.length !== 3) return null
  if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

function parseNumber(s) {
  if (!s) return null
  const n = parseFloat(s.replace(/[,$]/g, ''))
  return isNaN(n) ? null : n
}

// ── Main ──
async function run() {
  const startTime = Date.now()
  console.log('\n📋 ADUANET SCRAPER v2 — Proper login flow')
  console.log(`Last ${DAYS} days · ${HEADED ? 'headed' : 'headless'}`)
  console.log('═'.repeat(50))

  let browser, status = 'error', recordsFound = 0, recordsNew = 0

  try {
    browser = await puppeteer.launch({
      headless: HEADED ? false : 'new',
      protocolTimeout: 120000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1280, height: 800 })

    // Login with proper multi-step flow — may return a different page (popup)
    const activePage = await login(page, browser)
    await tg(`📋 <b>ADUANET conectado</b>\nBuscando pedimentos últimos ${DAYS} días\n— CRUZ 🦀`)

    // Extract pedimentos from whichever page login returned
    const tableData = await extractPedimentos(activePage)
    const records = parseTableRows(tableData)
    recordsFound = records.length
    console.log(`\nParsed ${records.length} pedimento records`)

    // Upsert to aduanet_facturas
    if (records.length > 0) {
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50)
        const { data, error } = await supabase
          .from('aduanet_facturas')
          .upsert(batch, { onConflict: 'pedimento,clave_cliente' })

        if (error) {
          console.error(`  Batch ${i} error: ${error.message}`)
        } else {
          recordsNew += batch.length
        }
      }
      console.log(`✅ ${recordsNew} pedimentos upserted to aduanet_facturas`)
    } else {
      console.log('No records to save — check screenshots at /tmp/aduanet-v2-*.png')
    }

    status = 'success'
    await browser.close()

  } catch (e) {
    console.error('❌ Scraper error:', e.message)
    await tg(`❌ <b>ADUANET scraper failed</b>\n${e.message}\nCheck /tmp/aduanet-v2-*.png\n— CRUZ 🦀`)
    if (browser) await browser.close()
  }

  // Log scrape run
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  await supabase.from('scrape_runs').insert({
    source: 'aduanet_v2',
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    status,
    records_found: recordsFound,
    records_new: recordsNew,
    metadata: { days: DAYS, elapsed_s: parseFloat(elapsed) }
  })

  console.log(`\n${ status === 'success' ? '✅' : '❌'} ADUANET scraper v2 — ${status} · ${recordsFound} found · ${recordsNew} saved · ${elapsed}s`)
  if (status === 'success' && recordsNew > 0) {
    await tg(`✅ <b>ADUANET scraper</b>\n${recordsNew} pedimentos guardados\n${elapsed}s\n— CRUZ 🦀`)
  }
}

run().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
