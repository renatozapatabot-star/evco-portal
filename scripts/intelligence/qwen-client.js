#!/usr/bin/env node
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen3:32b';

async function callQwen(prompt, options = {}) {
  const { temperature = 0.7, maxTokens = 2000 } = options;
  
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature, num_predict: maxTokens }
    })
  });
  
  const data = await response.json();
  return data.response;
}

module.exports = { callQwen, MODEL };

if (require.main === module) {
  (async () => {
    console.log('🧠 Testing Qwen Client...\n');
    const response = await callQwen('Responde: "CRUZ está listo" en español.');
    console.log('Response:', response);
  })().catch(console.error);
}
