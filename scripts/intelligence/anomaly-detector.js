const { callQwen } = require('./qwen-client');

async function detectAnomalies(shipments, historicalAvg) {
  const prompt = `
Compara estos envíos recientes con el histórico:

HISTÓRICO:
- Promedio diario: ${historicalAvg.daily} tráficos
- Documentos por tráfico: ${historicalAvg.docsPerShipment}
- Tasa de cruce: ${historicalAvg.crossingRate}%

ENVÍOS RECIENTES:
${shipments.slice(0, 20).map(s => 
  `- ${s.trafico}: ${s.docsCount} docs, ${s.daysWaiting} días`
).join('\n')}

Detecta anomalías. ¿Hay algo fuera de lo normal que requiera atención?
`;
  
  return await callQwen(prompt, { temperature: 0.2 });
}

module.exports = { detectAnomalies };
