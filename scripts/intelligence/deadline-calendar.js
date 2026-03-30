#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function analyzeDeadlines(deadlines) {
  const prompt = `Analiza estos plazos:\n${deadlines.map(d => `- ${d}`).join('\n')}\n\nIdentifica urgentes y conflictos.`;
  return await callQwen(prompt, { temperature: 0.3 });
}

module.exports = { analyzeDeadlines };
