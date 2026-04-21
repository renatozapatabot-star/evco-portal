const fs = require('fs')
const path = require('path')
const file = path.join(__dirname, 'globalpc-sync.js')
let code = fs.readFileSync(file, 'utf8')

// Add timeout tracker after OLLAMA_MODEL declaration
code = code.replace(
  "const OLLAMA_MODEL = 'qwen3:8b'",
  "const OLLAMA_MODEL = 'qwen3:8b'\nconst timeoutTracker = {} // track retries per product"
)

// Replace the catch block to track and skip after 3 failures
code = code.replace(
  `} catch (e) {
          console.error(\`   Ollama timeout/error for \${prod.cve_producto}: \${e.message}\`)
        }`,
  `} catch (e) {
          const key = prod.cve_producto
          timeoutTracker[key] = (timeoutTracker[key] || 0) + 1
          if (timeoutTracker[key] >= 3) {
            console.error(\`   ⛔ Skipping \${key} after 3 failures\`)
            await supabase.from('globalpc_productos').update({ fraccion_source: 'skip_timeout' }).eq('id', prod.id)
          } else {
            console.error(\`   Ollama timeout/error for \${key}: \${e.message} (attempt \${timeoutTracker[key]}/3)\`)
          }
        }`
)

fs.writeFileSync(file, code)
console.log('✅ globalpc-sync.js patched — skip after 3 timeouts')
