const { callQwen } = require('./qwen-client');

async function analyzeDocument(documentText, documentType) {
  const prompt = `
Analiza este ${documentType} aduanal:

${documentText.substring(0, 2000)}

Extrae:
1. Fracción arancelaria (si aparece)
2. Valor total en USD
3. Proveedor
4. ¿Está completa? (Sí/No, qué falta)

Responde en JSON.
`;
  
  return await callQwen(prompt, { temperature: 0.1 });
}

async function classifyProduct(description) {
  const prompt = `
Clasifica este producto para fracción arancelaria:
"${description}"

Sugiere la fracción más probable (formato XXXX.XX.XX) y explica por qué.
`;
  
  return await callQwen(prompt, { temperature: 0.3 });
}

module.exports = { analyzeDocument, classifyProduct };
