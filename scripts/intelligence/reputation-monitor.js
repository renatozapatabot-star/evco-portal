#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function analyzeSentiment(mentions) {
  const prompt = `Analiza sentimiento de estas menciones:\n${mentions.map(m => `- ${m}`).join('\n')}\n\nEvalúa positivo/negativo y acciones.`;
  return await callQwen(prompt, { temperature: 0.5 });
}

module.exports = { analyzeSentiment };
