#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function translateSAT(letter) {
  const prompt = `Traduce esta carta del SAT a español claro:\n\n${letter.substring(0, 1500)}\n\nRESPONDE:\n1. ¿Qué dice realmente?\n2. ¿Qué hay que hacer?\n3. ¿Fecha límite?`;
  return await callQwen(prompt, { temperature: 0.2 });
}

module.exports = { translateSAT };
