#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function optimizeRoute(origin, dest, weight, urgency) {
  const prompt = `Optimiza ruta de ${origin} a ${dest}, ${weight}kg, urgencia ${urgency}. Recomienda mejor opción.`;
  return await callQwen(prompt, { temperature: 0.4 });
}

module.exports = { optimizeRoute };
