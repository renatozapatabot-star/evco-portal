#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function auditClassifications(products) {
  const prompt = `Revisa estas clasificaciones:\n${products.map(p => `- ${p}`).join('\n')}\n\nIdentifica incorrectas y sugiere correcciones.`;
  return await callQwen(prompt, { temperature: 0.3 });
}

module.exports = { auditClassifications };
