#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function optimizePricing(service, volume) {
  const prompt = `Recomienda precio para ${service} con volumen ${volume} pedimentos/año. Incluye precio unitario y descuentos por volumen.`;
  return await callQwen(prompt, { temperature: 0.5 });
}

module.exports = { optimizePricing };
