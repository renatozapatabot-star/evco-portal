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
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TG) { console.log('[TG]', msg); return }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function run() {
  const startedAt = new Date().toISOString()
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

      // Step 5: Fill date range form (if present)
      const fechaFin = new Date()
      const fechaInicio = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
      const fmtDate = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

      const dateSelectors = [
        { name: 'fecha_inicio', aliases: ['FechaIni', 'fechaini', 'fecha_ini', 'FInicio'] },
        { name: 'fecha_fin', aliases: ['FechaFin', 'fechafin', 'fecha_fin', 'FFin'] },
      ]

      for (const ds of dateSelectors) {
        const dateValue = ds.name.includes('inicio') ? fmtDate(fechaInicio) : fmtDate(fechaFin)
        for (const alias of ds.aliases) {
          const el = await page.$(`input[name="${alias}"]`)
          if (el) {
            await el.click({ clickCount: 3 })
            await el.type(dateValue)
            console.log(`Filled ${alias} = ${dateValue}`)
            break
          }
        }
      }

      // Try submitting the search form
      const searchBtn = await page.$('input[type="submit"], button[type="submit"], input[value*="Buscar"], input[value*="Consultar"]')
      if (searchBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
          searchBtn.click()
        ])
        console.log('Search form submitted')
        await page.screenshot({ path: '/tmp/aduanet-05-results.png' })
      }

      // Step 6: Extract all table data (with pagination)
      let allRows = []
      let pageNum = 1

      while (true) {
        const tables = await page.evaluate(() => {
          const rows = []
          document.querySelectorAll('table tr').forEach(tr => {
            const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
            if (cells.length > 3) rows.push(cells)
          })
          return rows
        })

        // Also extract header row for column mapping
        if (pageNum === 1) {
          const headers = await page.evaluate(() => {
            const ths = []
            document.querySelectorAll('table tr th, table tr td.header, table thead td').forEach(th => {
              ths.push(th.innerText.trim().toLowerCase())
            })
            // Fallback: first row might be headers
            if (ths.length === 0) {
              const firstRow = document.querySelector('table tr')
              if (firstRow) {
                firstRow.querySelectorAll('td, th').forEach(td => ths.push(td.innerText.trim().toLowerCase()))
              }
            }
            return ths
          })
          console.log(`Column headers (page ${pageNum}):`, headers.join(' | '))
          // Save header mapping for reference
          console.log(`Data rows on page ${pageNum}: ${tables.length}`)
          tables.slice(0, 3).forEach(r => console.log('  Sample:', r.join(' | ')))
        }

        allRows.push(...tables)
        console.log(`Page ${pageNum}: ${tables.length} rows (total: ${allRows.length})`)

        // Look for "Next" / "Siguiente" pagination button
        const nextBtn = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, input[type="button"], input[type="submit"]'))
          const next = links.find(el => {
            const text = (el.innerText || el.value || '').toLowerCase()
            return text.includes('siguiente') || text.includes('next') || text.includes('>>') || text.includes('►')
          })
          return next ? (next.href || next.className || 'found') : null
        })

        if (!nextBtn || tables.length === 0) break

        // Click next page
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
            page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a, input'))
              const next = links.find(el => {
                const text = (el.innerText || el.value || '').toLowerCase()
                return text.includes('siguiente') || text.includes('next') || text.includes('>>')
              })
              if (next) next.click()
            })
          ])
          pageNum++
          if (pageNum > 50) { console.log('Safety: stopping at page 50'); break }
        } catch { break }
      }

      console.log(`\nTotal rows extracted: ${allRows.length}`)

      // Step 7: Parse rows into structured pedimento data
      // Column mapping is Aduanet-specific — log columns for manual verification
      // The scraper saves raw data and column headers to /tmp for the first run
      // After verifying column layout, the mapping below should be updated

      // Get companies for clave → company_id mapping
      const { data: companies } = await supabase
        .from('companies').select('company_id, clave_cliente').eq('active', true)
      const claveMap = {}
      ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

      // Auto-detect column indices from headers
      const headerRow = allRows.length > 0 ? allRows[0] : []
      const colMap = {}
      headerRow.forEach((h, i) => {
        const hl = (h || '').toLowerCase()
        if (hl.includes('pedimento')) colMap.pedimento = i
        if (hl.includes('fecha') && hl.includes('pago')) colMap.fecha_pago = i
        if (hl.includes('valor') || hl.includes('aduana')) colMap.valor = i
        if (hl.includes('dta')) colMap.dta = i
        if (hl.includes('igi') || hl.includes('arancel')) colMap.igi = i
        if (hl.includes('iva')) colMap.iva = i
        if (hl.includes('clave') || hl.includes('cliente')) colMap.clave = i
        if (hl.includes('referencia') || hl.includes('ref')) colMap.referencia = i
      })

      console.log('Auto-detected column mapping:', colMap)

      // Save raw data for manual verification
      const fs = require('fs')
      fs.writeFileSync('/tmp/aduanet-raw-data.json', JSON.stringify({
        headers: headerRow,
        columnMapping: colMap,
        sampleRows: allRows.slice(0, 10),
        totalRows: allRows.length,
        extractedAt: new Date().toISOString()
      }, null, 2))
      console.log('Raw data saved to /tmp/aduanet-raw-data.json')

      // Only parse and insert if we have a reasonable column mapping
      const hasMapping = colMap.pedimento !== undefined
      let inserted = 0
      let errors = 0

      if (hasMapping && allRows.length > 1) {
        const parseNum = s => {
          if (!s) return null
          const cleaned = String(s).replace(/[$,\s]/g, '')
          const n = parseFloat(cleaned)
          return isNaN(n) ? null : n
        }

        const dataRows = allRows.slice(1) // skip header row
        const pedimentos = []

        for (const cells of dataRows) {
          const pedimento = cells[colMap.pedimento]
          if (!pedimento || pedimento.length < 10) continue // skip non-pedimento rows

          pedimentos.push({
            pedimento: pedimento.trim(),
            fecha_pago: colMap.fecha_pago !== undefined ? cells[colMap.fecha_pago] || null : null,
            valor_usd: colMap.valor !== undefined ? parseNum(cells[colMap.valor]) : null,
            dta: colMap.dta !== undefined ? parseNum(cells[colMap.dta]) : null,
            igi: colMap.igi !== undefined ? parseNum(cells[colMap.igi]) : null,
            iva: colMap.iva !== undefined ? parseNum(cells[colMap.iva]) : null,
            clave_cliente: colMap.clave !== undefined ? cells[colMap.clave]?.trim() : null,
            referencia: colMap.referencia !== undefined ? cells[colMap.referencia]?.trim() : null,
          })
        }

        console.log(`\nParsed ${pedimentos.length} pedimentos from ${dataRows.length} data rows`)

        // Upsert to aduanet_facturas
        for (let i = 0; i < pedimentos.length; i += 50) {
          const batch = pedimentos.slice(i, i + 50).map(p => ({
            pedimento: p.pedimento,
            fecha_pago: p.fecha_pago,
            valor_usd: p.valor_usd,
            dta: p.dta,
            igi: p.igi,
            iva: p.iva,
            clave_cliente: p.clave_cliente,
            company_id: p.clave_cliente ? (claveMap[p.clave_cliente] || p.clave_cliente) : null,
            referencia: p.referencia,
            updated_at: new Date().toISOString(),
          }))

          const { error } = await supabase
            .from('aduanet_facturas')
            .upsert(batch, { onConflict: 'pedimento' })

          if (error) {
            console.error(`Batch ${i} error:`, error.message)
            errors++
          } else {
            inserted += batch.length
          }
        }

        console.log(`✅ Inserted/updated: ${inserted} pedimentos, ${errors} batch errors`)
        await tg(`📋 <b>ADUANET scraped</b>\n${inserted} pedimentos · ${DAYS} días · ${pageNum} páginas\n— CRUZ 🦀`)
      } else {
        console.log('\n⚠️  Column mapping incomplete or no data rows found.')
        console.log('   Run manually and check /tmp/aduanet-raw-data.json for column layout.')
        console.log('   Then update colMap detection in this script.')
        await tg(`⚠️ <b>ADUANET</b> — scrape completed but column mapping needs verification.\nCheck /tmp/aduanet-raw-data.json\n— CRUZ 🦀`)
      }
    } else {
      console.log('No pedimento link found. Available:', links.map(l => l.text).join(', '))
      await tg(`⚠️ <b>ADUANET</b> — no pedimento link found in menu\n— CRUZ 🦀`)
    }

    await browser.close()
    console.log('\n✅ Scraper complete')
    console.log('Check /tmp/aduanet-*.png for screenshots')

    // Log scrape run
    await supabase.from('scrape_runs').insert({
      source: 'aduanet_puppeteer',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'success',
      metadata: { days: DAYS }
    })

  } catch (e) {
    console.error('Scraper error:', e.message)
    await tg(`❌ ADUANET scraper error: ${e.message}\n— CRUZ 🦀`)
    if (browser) await browser.close()

    await supabase.from('scrape_runs').insert({
      source: 'aduanet_puppeteer',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'error',
      error_message: e.message,
      metadata: { days: DAYS }
    })
  }
}

run().catch(console.error)
