#!/usr/bin/env node
const { NeuralBridge } = require('./index.js');

async function main() {
  const bridge = new NeuralBridge();
  const result = await bridge.feedClaude();
  console.log('✅ Claude updated with neural bridge data');
  console.log('📁 Location: .claude/cruz-neural.md');
}

main().catch(console.error);
