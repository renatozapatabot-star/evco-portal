#!/usr/bin/env node
const { NeuralBridge } = require('./index.js');

async function main() {
  const bridge = new NeuralBridge();
  await bridge.dailyReport();
}

main().catch(console.error);
