#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function generateScenario(topic, difficulty) {
  const prompt = `Crea escenario de entrenamiento aduanal:\nTEMA: ${topic}\nDIFICULTAD: ${difficulty}\n\nIncluye pregunta y respuesta esperada.`;
  return await callQwen(prompt, { temperature: 0.6 });
}

module.exports = { generateScenario };
