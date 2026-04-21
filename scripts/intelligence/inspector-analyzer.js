#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function predictInspectionRisk(shipment, patterns) {
  const prompt = `Predice inspección para:\n${shipment}\nPATRONES: ${patterns}\n\nProbabilidad % y preparación.`;
  return await callQwen(prompt, { temperature: 0.4 });
}

module.exports = { predictInspectionRisk };
