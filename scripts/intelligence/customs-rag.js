#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function answerWithContext(question, context) {
  const prompt = `Responde usando SOLO esta info:\n\nCONTEXTO: ${context}\n\nPREGUNTA: ${question}\n\nSi no está en el contexto, di "No encontré información".`;
  return await callQwen(prompt, { temperature: 0.3 });
}

module.exports = { answerWithContext };
