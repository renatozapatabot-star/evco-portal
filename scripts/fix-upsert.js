const fs = require('fs')
const path = require('path')
const file = path.join(__dirname, 'doc-classifier.js')
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  "await supabase.from('document_classifications').upsert({",
  "await supabase.from('document_classifications').upsert({"
)

// Add onConflict after the closing })
code = code.replace(
  `    confidence: result.confidence
  })`,
  `    confidence: result.confidence,
    source: 'email'
  }, { onConflict: 'filename,source' })`
)

fs.writeFileSync(file, code)
console.log('✅ upsert onConflict added')
