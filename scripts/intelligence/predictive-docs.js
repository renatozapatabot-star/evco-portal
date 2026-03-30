#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function predictMissingDocs(shipment) {
  const prompt = `Predice documentos faltantes para:\n${shipment}\n\nRecomienda qué solicitar y cuándo.`;
  return await callQwen(prompt, { temperature: 0.4 });
}

module.exports = { predictMissingDocs };
