#!/usr/bin/env node
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const FAST_MODEL = 'qwen3:8b';
const SMART_MODEL = 'qwen3:32b';

async function callQwenFast(prompt, options = {}) {
  const { temperature = 0, maxTokens = 100, model = FAST_MODEL } = options;
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: { temperature, num_predict: maxTokens }
      })
    });
    
    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    
    return { 
      output: data.response || '', 
      latencyMs, 
      error: null 
    };
    
  } catch (error) {
    return { output: null, latencyMs: Date.now() - startTime, error: error.message };
  }
}

async function callQwenSmart(prompt, options = {}) {
  return callQwenFast(prompt, { ...options, model: SMART_MODEL, maxTokens: options.maxTokens || 500 });
}

module.exports = { callQwenFast, callQwenSmart };
