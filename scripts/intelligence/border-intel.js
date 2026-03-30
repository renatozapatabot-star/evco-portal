#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function borderBriefing(cbpData, news) {
  const prompt = `Genera briefing fronterizo:\nCBP: ${cbpData}\nNOTICIAS: ${news}\n\nIncluye resumen y recomendaciones.`;
  return await callQwen(prompt, { temperature: 0.4 });
}

module.exports = { borderBriefing };
