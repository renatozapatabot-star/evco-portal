const fs = require('fs')
const path = require('path')

// Fix doc-classifier.js
const dcPath = path.join(__dirname, 'doc-classifier.js')
let dc = fs.readFileSync(dcPath, 'utf8')
dc = dc.replace("const pdfParse = require('pdf-parse')", "const { PDFParse } = require('pdf-parse')")
dc = dc.replace(
  /async function extractPdfText\(filePath\) \{[\s\S]*?\n\}/,
  `async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath)
  const uint8 = new Uint8Array(buffer)
  const parser = new PDFParse(uint8)
  const result = await parser.getText()
  return result.text || ''
}`
)
fs.writeFileSync(dcPath, dc)
console.log('✅ doc-classifier.js fixed')

// Fix email-intake.js
const eiPath = path.join(__dirname, 'email-intake.js')
let ei = fs.readFileSync(eiPath, 'utf8')
ei = ei.replace("const pdfParse = require('pdf-parse')", "const { PDFParse } = require('pdf-parse')")
ei = ei.replace(
  /async function extractPdfText\(filePath\) \{[\s\S]*?\n\}/,
  `async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath)
  const uint8 = new Uint8Array(buf)
  const parser = new PDFParse(uint8)
  const result = await parser.getText()
  const text = (result.text || '').trim()
  if (text.length < 20) {
    return { text: '', needsVision: true }
  }
  return { text, needsVision: false }
}`
)
fs.writeFileSync(eiPath, ei)
console.log('✅ email-intake.js fixed')
