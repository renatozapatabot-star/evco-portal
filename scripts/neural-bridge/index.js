#!/usr/bin/env node
/**
 * CRUZ Neural Bridge — The Compounding Intelligence System
 * Every interaction makes the entire system smarter.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class NeuralBridge {
  constructor() {
    this.captures = [];
  }

  async capture(input, output, context, confidence = 0.5) {
    const record = {
      id: Math.random().toString(36).substring(2),
      timestamp: new Date().toISOString(),
      input: input.substring(0, 500),
      output: output.substring(0, 500),
      context: context,
      confidence: confidence,
      success: !output?.toLowerCase().includes('error')
    };
    
    this.captures.push(record);
    
    // Save to file
    fs.appendFileSync(
      path.join(__dirname, '../../data/neural-bridge/captures.jsonl'),
      JSON.stringify(record) + '\n'
    );
    
    // Every 10 captures, trigger quick learning
    if (this.captures.length >= 10) {
      await this.quickLearn();
      this.captures = [];
    }
    
    return record;
  }

  async quickLearn() {
    const recent = this.captures;
    if (recent.length === 0) return;
    
    const prompt = `Analiza estos ${recent.length} patrones y da 1 sugerencia para mejorar:\n${JSON.stringify(recent, null, 2)}`;
    
    try {
      const result = await this.callQwen(prompt);
      fs.appendFileSync(
        path.join(__dirname, '../../data/neural-bridge/learnings.jsonl'),
        JSON.stringify({ timestamp: new Date().toISOString(), learning: result }) + '\n'
      );
    } catch (e) {
      console.error('Quick learn failed:', e.message);
    }
  }

  async dailyReport() {
    const today = new Date().toISOString().split('T')[0];
    
    // Count captures today
    const captures = fs.readFileSync(
      path.join(__dirname, '../../data/neural-bridge/captures.jsonl'),
      'utf8'
    ).split('\n').filter(l => l.includes(today));
    
    const report = `
📈 CRUZ COMPOUNDING REPORT — ${today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TODAY'S GROWTH:
- Interactions captured: ${captures.length}
- Knowledge base size: ${this.getFileSize('captures.jsonl')}
- Learnings recorded: ${this.getFileSize('learnings.jsonl')}

🧠 COMPOUNDING EFFECT:
- Total knowledge: ${this.getTotalLines('captures.jsonl')} interactions
- System age: ${this.getSystemAge()} days

🔮 TOMORROW'S FOCUS:
Continue pattern recognition and intelligence gathering

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRUZ Neural Bridge — Compounding Intelligence
    `;
    
    // Save report
    fs.writeFileSync(
      path.join(__dirname, `../../data/reports/${today}.md`),
      report
    );
    
    console.log(report);
    return report;
  }

  async feedClaude() {
    const summary = await this.generateSummary();
    
    const quickRef = `
# CRUZ Neural Bridge — Learned Patterns

## Last 10 Interactions:
${this.getLastInteractions(10)}

## System Status:
- Total captures: ${this.getTotalLines('captures.jsonl')}
- Total learnings: ${this.getTotalLines('learnings.jsonl')}
- Last update: ${new Date().toISOString()}

## What CRUZ Has Learned:
${summary.substring(0, 500)}
    `;
    
    fs.writeFileSync(
      path.join(__dirname, '../../.claude/cruz-neural.md'),
      quickRef
    );
    
    return quickRef;
  }

  async generateSummary() {
    const captures = fs.readFileSync(
      path.join(__dirname, '../../data/neural-bridge/captures.jsonl'),
      'utf8'
    ).split('\n').filter(l => l.trim()).slice(-20);
    
    if (captures.length === 0) return "No data yet. System is learning.";
    
    const prompt = `Resume estos ${captures.length} patrones en 3 líneas:\n${captures.join('\n')}`;
    
    try {
      return await this.callQwen(prompt);
    } catch (e) {
      return "Learning in progress...";
    }
  }

  async callQwen(prompt) {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:32b',
        prompt: prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 500 }
      })
    });
    const data = await response.json();
    return data.response;
  }

  getFileSize(filename) {
    const file = path.join(__dirname, '../../data/neural-bridge/', filename);
    try {
      const stats = fs.statSync(file);
      return Math.round(stats.size / 1024) + ' KB';
    } catch { return '0 KB'; }
  }

  getTotalLines(filename) {
    const file = path.join(__dirname, '../../data/neural-bridge/', filename);
    try {
      const content = fs.readFileSync(file, 'utf8');
      return content.split('\n').filter(l => l.trim()).length;
    } catch { return 0; }
  }

  getSystemAge() {
    const firstFile = path.join(__dirname, '../../data/neural-bridge/captures.jsonl');
    try {
      const stats = fs.statSync(firstFile);
      const days = Math.floor((Date.now() - stats.birthtime) / (1000 * 60 * 60 * 24));
      return Math.max(1, days);
    } catch { return 1; }
  }

  getLastInteractions(n) {
    const file = path.join(__dirname, '../../data/neural-bridge/captures.jsonl');
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(l => l.trim()).slice(-n);
      return lines.map(l => {
        try {
          const parsed = JSON.parse(l);
          return `- ${parsed.input?.substring(0, 80)}...`;
        } catch { return '- [parsing error]'; }
      }).join('\n');
    } catch { return 'No interactions yet.'; }
  }
}

async function runNeuralBridge() {
  console.log('🧠 CRUZ Neural Bridge — Compounding Intelligence');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const bridge = new NeuralBridge();
  
  // Capture recent activity from modules
  console.log('📊 Capturing recent activity...');
  
  // Generate daily report
  console.log('📈 Generating daily report...');
  await bridge.dailyReport();
  
  // Feed Claude
  console.log('🤖 Feeding Claude...');
  await bridge.feedClaude();
  
  console.log('✅ Compounding complete. System is smarter today.');
}

if (require.main === module) {
  runNeuralBridge().catch(console.error);
}

module.exports = { NeuralBridge, runNeuralBridge };
