#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

class MetaLearner {
  async learnFromMistakes(mistakes) {
    if (!mistakes?.length) return null;
    const prompt = `Analiza estos errores:\n${mistakes.map(m => `- ${m}`).join('\n')}\n\nIdentifica patrones y sugiere mejoras.`;
    return await callQwen(prompt, { temperature: 0.4 });
  }
}

module.exports = new MetaLearner();
