#!/usr/bin/env node
// scripts/v2c-managed-agent/run-classifier.js
// V2-C Managed Agent — Entry point.
// Multi-step tool-use loop for product classification.
// Does NOT modify any existing files.

const { runJob, supabase } = require('../lib/job-runner')
const { llmCall } = require('../lib/llm')
const { CLASSIFIER_TOOLS, SYSTEM_PROMPT } = require('./agent-config')
const { executeTool, setCurrentProduct } = require('./tool-executor')

const args = process.argv.slice(2)
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10', 10)
const DRY_RUN = args.includes('--dry-run')
const MAX_TOOL_ITERATIONS = 5

runJob('v2c-classifier', async () => {
  const { data: unclassified, error } = await supabase
    .from('globalpc_productos')
    .select('id, descripcion, cve_proveedor, company_id')
    .is('fraccion', null)
    .limit(LIMIT)

  if (error) {
    throw new Error(`Failed to query unclassified products: ${error.message}`)
  }

  if (!unclassified?.length) {
    console.log('[v2c] No unclassified products found')
    return { rowsProcessed: 0 }
  }

  console.log(`[v2c] Found ${unclassified.length} unclassified products`)

  if (DRY_RUN) {
    console.log('[v2c] DRY RUN — listing products only:')
    for (const p of unclassified) {
      console.log(`  ${p.id}: ${(p.descripcion || '').slice(0, 60)} (${p.cve_proveedor || 'unknown'})`)
    }
    return { rowsProcessed: 0, metadata: { mode: 'dry-run', found: unclassified.length } }
  }

  let classified = 0

  for (const product of unclassified) {
    const desc = (product.descripcion || '').slice(0, 60)
    console.log(`\n[v2c] Classifying: ${desc}`)

    // Set product context for tool executor
    setCurrentProduct(product)

    try {
      const messages = [{
        role: 'user',
        content: `Clasifica este producto:\n\nID: ${product.id}\nDescripcion: ${product.descripcion}\nProveedor: ${product.cve_proveedor || 'Desconocido'}\nEmpresa: ${product.company_id || 'Desconocida'}\n\nUsa las herramientas para consultar historial, verificar tasas, y enviar clasificacion.`,
      }]

      let finished = false

      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await llmCall({
          modelClass: 'fast',
          messages,
          system: SYSTEM_PROMPT,
          tools: CLASSIFIER_TOOLS,
          callerName: 'v2c-classifier',
        })

        const toolUses = (result.raw.content || []).filter(b => b.type === 'tool_use')

        // If no tool calls or end_turn, agent is done
        if (toolUses.length === 0 || result.raw.stop_reason === 'end_turn') {
          console.log(`[v2c] Agent finished (${i + 1} iterations): ${(result.text || '').slice(0, 200)}`)
          classified++
          finished = true
          break
        }

        // Execute each tool and collect results
        const toolResults = []
        for (const tu of toolUses) {
          console.log(`[v2c]   Tool call: ${tu.name}(${JSON.stringify(tu.input).slice(0, 100)})`)
          const toolResult = await executeTool(tu.name, tu.input)
          console.log(`[v2c]   Tool result: ${JSON.stringify(toolResult).slice(0, 150)}`)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(toolResult),
          })
        }

        // Append assistant response + tool results to conversation
        messages.push({ role: 'assistant', content: result.raw.content })
        messages.push({ role: 'user', content: toolResults })
      }

      if (!finished) {
        console.warn(`[v2c] Max iterations reached for product ${product.id}`)
      }
    } catch (err) {
      console.error(`[v2c] Failed to classify product ${product.id}: ${err.message}`)
    }
  }

  return {
    rowsProcessed: classified,
    metadata: { total: unclassified.length, classified },
  }
})
