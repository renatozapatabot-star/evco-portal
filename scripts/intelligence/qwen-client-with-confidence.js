#!/usr/bin/env node
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen3:32b';

async function callQwen(prompt, options = {}) {
  const { temperature = 0.7, maxTokens = 2000, requireConfidence = false } = options;
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: requireConfidence 
          ? `${prompt}\n\nDespués de tu respuesta, añade una línea con CONFIANZA: [0-100]% basado en qué tan seguro estás.`
          : prompt,
        stream: false,
        options: { temperature, num_predict: maxTokens }
      })
    });
    
    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    
    let confidence = 0.7;
    let output = data.response;
    
    if (requireConfidence) {
      const match = output.match(/CONFIANZA:\s*(\d+)/i);
      if (match) {
        confidence = parseInt(match[1]) / 100;
        output = output.replace(/CONFIANZA:\s*\d+%.*\n?/i, '').trim();
      }
    }
    
    return { output, confidence, latencyMs, error: null };
    
  } catch (error) {
    return { output: null, confidence: 0, latencyMs: Date.now() - startTime, error: error.message };
  }
}

module.exports = { callQwen, MODEL };
