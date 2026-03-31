#!/usr/bin/env node
const OLLAMA_URL = 'http://localhost:11434/api/generate';

async function callQwen(prompt, options = {}) {
  const { temperature = 0, maxTokens = 200, module = 'unknown' } = options;
  
  // Both models are thinking models, use 8b for speed
  const model = 'qwen3:8b';
  
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
    
    let output = data.response || '';
    
    // Extract from thinking if response is empty
    if (!output && data.thinking) {
      // Look for ALTO/MEDIO/BAJO for MVE risk
      const riskMatch = data.thinking.match(/\b(ALTO|MEDIO|BAJO)\b/i);
      if (riskMatch) {
        output = riskMatch[1];
      }
      
      // Look for bridge names
      const bridgeMatch = data.thinking.match(/\b(Colombia|WTC|World Trade|Gateway|Juárez)\b/i);
      if (!output && bridgeMatch) {
        output = bridgeMatch[1];
      }
      
      // If nothing matches, take the last sentence that looks like an answer
      if (!output) {
        const sentences = data.thinking.split(/[.!?]\s+/);
        const lastSentence = sentences[sentences.length - 1];
        if (lastSentence && lastSentence.length < 50) {
          output = lastSentence.trim();
        }
      }
    }
    
    output = output.trim().replace(/^["']|["']$/g, '');
    
    return { 
      output: output || '(no output)', 
      confidence: 0.8,
      latencyMs,
      model: model,
      thinking: data.thinking ? data.thinking.substring(0, 100) : null,
      error: null 
    };
    
  } catch (error) {
    return { output: null, confidence: 0, latencyMs: Date.now() - startTime, error: error.message };
  }
}

module.exports = { callQwen };
