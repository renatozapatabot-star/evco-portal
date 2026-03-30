#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function extractMetadata(content) {
  const prompt = `Extrae metadatos de este documento:\n${content.substring(0, 1000)}\n\nResponde en JSON: tipo, referencia, proveedor, fecha, valor.`;
  return await callQwen(prompt, { temperature: 0.2 });
}

module.exports = { extractMetadata };
