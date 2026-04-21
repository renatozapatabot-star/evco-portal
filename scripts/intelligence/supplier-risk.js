#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function assessSupplierRisk(supplierData) {
  const prompt = `Evalúa riesgo de proveedor:\n${supplierData}\n\nCalcula score 1-100 y acción recomendada.`;
  return await callQwen(prompt, { temperature: 0.4 });
}

module.exports = { assessSupplierRisk };
