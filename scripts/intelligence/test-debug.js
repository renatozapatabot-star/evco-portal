const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen3:32b';

async function call(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0, num_predict: 50 }
    })
  });
  const data = await res.json();
  console.log('RAW RESPONSE:', data);
  return data.response;
}

call('Trafico 9254-Y4466, documentos incompletos. Riesgo MVE? Responde SOLO: ALTO/MEDIO/BAJO').then(r => console.log('OUTPUT:', r));
