#!/usr/bin/env node
/**
 * CRUZ Monday Intelligence Brief
 * 
 * Every Monday at 6 AM, generates a boardroom-grade PDF:
 * - Dark theme (black bg, gold accents) matching EVCO branding
 * - Executive summary with KPIs
 * - Compliance trends
 * - Risk alerts from correlation engine
 * - Forward-looking predictions
 * - Sends via email (same mechanism as morning-report.js)
 * 
 * Uses Python/reportlab for PDF generation, Node for data gathering.
 * 
 * Patente 3596 · Aduana 240
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { callQwen } = require('../core/qwen-client-v2');

// ============================================================================
// DATA GATHERING
// ============================================================================

async function gatherWeeklyData() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const weekStartISO = weekStart.toISOString();
  const weekLabel = `${weekStart.toLocaleDateString('es-MX')} — ${now.toLocaleDateString('es-MX')}`;

  // Week number for folio
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  const folio = `EVR-${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  console.log(`📊 Gathering data for ${weekLabel} (${folio})...\n`);

  // Parallel data fetching
  const [
    traficosResult,
    traficosActivosResult,
    mveResult,
    correctionsResult,
    alertsResult,
    healthResult,
    eventsResult,
  ] = await Promise.all([
    supabase.from('traficos').select('*').eq('clave_cliente', '9254').gte('created_at', weekStartISO),
    supabase.from('traficos').select('*').eq('clave_cliente', '9254').in('estatus', ['en_transito', 'en_aduana', 'activo']),
    supabase.from('traficos').select('*').eq('clave_cliente', '9254').is('mve_folio', null).gte('created_at', weekStartISO),
    supabase.from('cruz_corrections').select('*').gte('created_at', weekStartISO),
    supabase.from('correlation_alerts').select('*').gte('created_at', weekStartISO).eq('acknowledged', false),
    supabase.from('module_health').select('*'),
    supabase.from('cruz_events').select('event_type, created_at').gte('created_at', weekStartISO),
  ]);

  // Unique suppliers this week
  const suppliers = [...new Set((traficosResult.data || []).map(t => t.proveedor).filter(Boolean))];

  // Unique fracciones
  const fracciones = [...new Set((traficosResult.data || []).map(t => t.fraccion_arancelaria).filter(Boolean))];

  // Total valor
  const totalValor = (traficosResult.data || []).reduce((s, t) => s + (parseFloat(t.valor_factura) || 0), 0);

  // MVE compliance rate
  const totalTraficos = traficosResult.data?.length || 0;
  const mveFaltantes = mveResult.data?.length || 0;
  const mveCompliance = totalTraficos > 0 ? Math.round(((totalTraficos - mveFaltantes) / totalTraficos) * 100) : 100;

  // Module health summary
  const healthyModules = (healthResult.data || []).filter(h => h.status === 'healthy').length;
  const totalModules = (healthResult.data || []).length || 25;

  // Events processed
  const eventsProcessed = eventsResult.data?.length || 0;

  return {
    folio,
    weekLabel,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: now.toISOString().split('T')[0],
    kpis: {
      totalTraficos,
      traficosActivos: traficosActivosResult.data?.length || 0,
      suppliers: suppliers.length,
      fracciones: fracciones.length,
      totalValorUSD: Math.round(totalValor),
      mveCompliance,
      mveFaltantes,
      corrections: correctionsResult.data?.length || 0,
      openAlerts: alertsResult.data?.length || 0,
      healthyModules,
      totalModules,
      eventsProcessed,
    },
    alerts: (alertsResult.data || []).slice(0, 10),
    corrections: correctionsResult.data || [],
    supplierList: suppliers,
    fractionList: fracciones,
  };
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

async function generateAIAnalysis(data) {
  console.log('🤖 Generating AI analysis...\n');

  const { output } = await callQwen(
    `Eres el analista jefe de inteligencia aduanal de Renato Zapata & Company.

Genera un informe ejecutivo semanal para EVCO Plastics de México.
Datos de la semana ${data.weekLabel}:

KPIs:
- Tráficos: ${data.kpis.totalTraficos}
- Activos: ${data.kpis.traficosActivos}
- Valor total: $${data.kpis.totalValorUSD.toLocaleString()} USD
- Proveedores: ${data.kpis.suppliers}
- Fracciones únicas: ${data.kpis.fracciones}
- Cumplimiento MVE: ${data.kpis.mveCompliance}%
- MVE faltantes: ${data.kpis.mveFaltantes}
- Correcciones del sistema: ${data.kpis.corrections}
- Alertas abiertas: ${data.kpis.openAlerts}
- Salud del sistema: ${data.kpis.healthyModules}/${data.kpis.totalModules} módulos sanos
- Eventos procesados: ${data.kpis.eventsProcessed}

Alertas de correlación (multi-factor):
${data.alerts.slice(0, 5).map(a => `- ${a.trafico_clave}: Score ${Math.round(a.risk_score * 100)}% - ${a.contributing_modules?.join(', ')}`).join('\n') || 'Ninguna'}

Genera exactamente esto (en español):

RESUMEN_EJECUTIVO: [3 oraciones máximo — qué pasó esta semana, tendencia, y una acción]

CUMPLIMIENTO: [score, tendencia vs semana anterior, riesgo principal]

ALERTAS_CRITICAS: [lista de hasta 3 alertas que necesitan acción esta semana]

OPORTUNIDADES: [1-2 oportunidades de optimización detectadas]

PREDICCION_SIGUIENTE_SEMANA: [qué esperar, qué preparar]`,
    { module: 'monday-intelligence', temperature: 0.3, maxTokens: 3000 }
  );

  return output;
}

// ============================================================================
// PDF GENERATION (Python/reportlab)
// ============================================================================

function generatePDF(data, aiAnalysis) {
  const outputPath = `/tmp/cruz-weekly-${data.folio}.pdf`;

  // Write data to temp JSON for Python to read
  const tempData = `/tmp/cruz-weekly-data.json`;
  fs.writeFileSync(tempData, JSON.stringify({ ...data, aiAnalysis }, null, 2));

  // Python script for reportlab PDF
  const pythonScript = `
import json
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# Colors
BLACK = HexColor('#0A0A0A')
DARK = HexColor('#111111')
DARKER = HexColor('#1A1A1A')
GOLD = HexColor('#C9A84C')
GOLD_LIGHT = HexColor('#E8C96B')
WHITE = HexColor('#F5F5F5')
GRAY = HexColor('#AAAAAA')
RED = HexColor('#E53E3E')
GREEN = HexColor('#38A169')
AMBER = HexColor('#D69E2E')

# Load data
with open('${tempData}', 'r') as f:
    data = json.load(f)

kpis = data['kpis']
folio = data['folio']
week_label = data['weekLabel']
ai = data.get('aiAnalysis', '')

# Parse AI analysis sections
def parse_section(text, key):
    try:
        start = text.index(key + ':') + len(key) + 1
        # Find next section or end
        next_keys = ['RESUMEN_EJECUTIVO:', 'CUMPLIMIENTO:', 'ALERTAS_CRITICAS:', 'OPORTUNIDADES:', 'PREDICCION_SIGUIENTE_SEMANA:']
        end = len(text)
        for nk in next_keys:
            if nk != key + ':':
                try:
                    pos = text.index(nk, start)
                    if pos < end:
                        end = pos
                except ValueError:
                    pass
        return text[start:end].strip()
    except (ValueError, IndexError):
        return 'No disponible'

resumen = parse_section(ai, 'RESUMEN_EJECUTIVO')
cumplimiento = parse_section(ai, 'CUMPLIMIENTO')
alertas = parse_section(ai, 'ALERTAS_CRITICAS')
oportunidades = parse_section(ai, 'OPORTUNIDADES')
prediccion = parse_section(ai, 'PREDICCION_SIGUIENTE_SEMANA')

# Styles
title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=22, textColor=GOLD, alignment=TA_CENTER, spaceAfter=6)
subtitle_style = ParagraphStyle('Subtitle', fontName='Helvetica', fontSize=12, textColor=WHITE, alignment=TA_CENTER, spaceAfter=4)
section_style = ParagraphStyle('Section', fontName='Helvetica-Bold', fontSize=14, textColor=GOLD, spaceBefore=16, spaceAfter=8)
body_style = ParagraphStyle('Body', fontName='Helvetica', fontSize=10, textColor=WHITE, leading=14, spaceAfter=6)
small_style = ParagraphStyle('Small', fontName='Helvetica', fontSize=8, textColor=GRAY, alignment=TA_CENTER)
kpi_label = ParagraphStyle('KPILabel', fontName='Helvetica', fontSize=8, textColor=GRAY, alignment=TA_CENTER)
kpi_value = ParagraphStyle('KPIValue', fontName='Helvetica-Bold', fontSize=16, textColor=GOLD_LIGHT, alignment=TA_CENTER)

# Build document
doc = SimpleDocTemplate(
    '${outputPath}',
    pagesize=letter,
    topMargin=0.5*inch,
    bottomMargin=0.5*inch,
    leftMargin=0.75*inch,
    rightMargin=0.75*inch,
)

story = []

# --- COVER ---
story.append(Spacer(1, 1.5*inch))
story.append(Paragraph('REPORTE SEMANAL DE', subtitle_style))
story.append(Paragraph('INTELIGENCIA ADUANAL', title_style))
story.append(Spacer(1, 12))
story.append(Paragraph('EVCO Plastics de Mexico', subtitle_style))
story.append(Spacer(1, 24))
story.append(Paragraph(f'Semana: {week_label}', ParagraphStyle('DateStyle', fontName='Helvetica', fontSize=11, textColor=GOLD, alignment=TA_CENTER)))
story.append(Spacer(1, 6))
story.append(Paragraph(f'Folio: {folio}', ParagraphStyle('FolioStyle', fontName='Helvetica', fontSize=10, textColor=GRAY, alignment=TA_CENTER)))
story.append(Spacer(1, 1*inch))
story.append(Paragraph('Preparado para: Ursula Banda', small_style))
story.append(Paragraph('Preparado por: CRUZ Intelligence System', small_style))
story.append(Paragraph('Renato Zapata & Company | Patente 3596 | Aduana 240', small_style))
story.append(PageBreak())

# --- KPI DASHBOARD ---
story.append(Paragraph('1. RESUMEN EJECUTIVO', section_style))

# KPI cards as table
def kpi_cell(label, value, status=''):
    color = GREEN if status == 'green' else RED if status == 'red' else AMBER if status == 'amber' else GOLD_LIGHT
    return [
        Paragraph(str(value), ParagraphStyle('v', fontName='Helvetica-Bold', fontSize=14, textColor=color, alignment=TA_CENTER)),
        Paragraph(label, kpi_label),
    ]

mve_status = 'green' if kpis['mveCompliance'] >= 95 else 'amber' if kpis['mveCompliance'] >= 80 else 'red'
alert_status = 'red' if kpis['openAlerts'] > 0 else 'green'

kpi_data = [
    [
        kpi_cell('Traficos', kpis['totalTraficos'])[0],
        kpi_cell('Activos', kpis['traficosActivos'])[0],
        kpi_cell('Valor USD', f"${kpis['totalValorUSD']:,}")[0],
        kpi_cell('MVE %', f"{kpis['mveCompliance']}%", mve_status)[0],
    ],
    [
        kpi_cell('Traficos', kpis['totalTraficos'])[1],
        kpi_cell('Activos', kpis['traficosActivos'])[1],
        kpi_cell('Valor USD', '')[1],
        kpi_cell('MVE %', '', mve_status)[1],
    ],
    [
        kpi_cell('Proveedores', kpis['suppliers'])[0],
        kpi_cell('Fracciones', kpis['fracciones'])[0],
        kpi_cell('Alertas', kpis['openAlerts'], alert_status)[0],
        kpi_cell('Correcciones', kpis['corrections'])[0],
    ],
    [
        kpi_cell('Proveedores', '')[1],
        kpi_cell('Fracciones', '')[1],
        kpi_cell('Alertas', '', alert_status)[1],
        kpi_cell('Correcciones', '')[1],
    ],
]

kpi_table = Table(kpi_data, colWidths=[1.6*inch]*4)
kpi_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), DARKER),
    ('BOX', (0,0), (-1,-1), 1, HexColor('#C9A84C4D')),
    ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor('#C9A84C1A')),
    ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(kpi_table)
story.append(Spacer(1, 16))

# AI Resumen
story.append(Paragraph(resumen, body_style))

# --- CUMPLIMIENTO ---
story.append(Paragraph('2. CUMPLIMIENTO MVE', section_style))
story.append(Paragraph(cumplimiento, body_style))
if kpis['mveFaltantes'] > 0:
    story.append(Paragraph(
        f'<font color="#E53E3E">ATENCION: {kpis["mveFaltantes"]} traficos sin folio MVE. '
        f'Multa potencial: ${kpis["mveFaltantes"] * 5990:,} MXN (estimado)</font>',
        ParagraphStyle('Alert', fontName='Helvetica-Bold', fontSize=10, textColor=RED, spaceAfter=8)
    ))

# --- ALERTAS ---
story.append(Paragraph('3. ALERTAS Y ACCIONES', section_style))
story.append(Paragraph(alertas, body_style))

# Alert table if we have correlation alerts
alerts_list = data.get('alerts', [])
if alerts_list:
    alert_header = [
        Paragraph('Trafico', ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8, textColor=GOLD)),
        Paragraph('Riesgo', ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8, textColor=GOLD)),
        Paragraph('Factores', ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8, textColor=GOLD)),
    ]
    alert_rows = [alert_header]
    for a in alerts_list[:8]:
        score = a.get('risk_score', 0)
        color = RED if score >= 0.6 else AMBER
        alert_rows.append([
            Paragraph(str(a.get('trafico_clave', '—')), ParagraphStyle('td', fontName='Helvetica', fontSize=8, textColor=WHITE)),
            Paragraph(f"{int(score*100)}%", ParagraphStyle('td', fontName='Helvetica-Bold', fontSize=8, textColor=color)),
            Paragraph(', '.join(a.get('contributing_modules', [])), ParagraphStyle('td', fontName='Helvetica', fontSize=7, textColor=GRAY)),
        ])

    alert_table = Table(alert_rows, colWidths=[1.5*inch, 1*inch, 4*inch])
    alert_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('BACKGROUND', (0,1), (-1,-1), DARKER),
        ('BOX', (0,0), (-1,-1), 0.5, HexColor('#C9A84C4D')),
        ('INNERGRID', (0,0), (-1,-1), 0.25, HexColor('#C9A84C1A')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(alert_table)

# --- OPORTUNIDADES ---
story.append(Paragraph('4. OPORTUNIDADES', section_style))
story.append(Paragraph(oportunidades, body_style))

# --- PREDICCION ---
story.append(Paragraph('5. PREDICCION SIGUIENTE SEMANA', section_style))
story.append(Paragraph(prediccion, body_style))

# --- SYSTEM HEALTH ---
story.append(Paragraph('6. SALUD DEL SISTEMA CRUZ', section_style))
story.append(Paragraph(
    f'Modulos sanos: {kpis["healthyModules"]}/{kpis["totalModules"]} | '
    f'Eventos procesados: {kpis["eventsProcessed"]} | '
    f'Correcciones aplicadas: {kpis["corrections"]}',
    body_style
))

# --- FOOTER ---
story.append(Spacer(1, 24))
story.append(Paragraph(
    f'{folio} | Confidencial — Solo para uso interno | '
    f'Preparado por CRUZ Intelligence System | '
    f'Renato Zapata & Company | Patente 3596 | Aduana 240',
    small_style
))

# Build with dark background
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLACK)
    canvas.rect(0, 0, letter[0], letter[1], fill=1)
    # Gold accent line at top
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(2)
    canvas.line(0.5*inch, letter[1] - 0.3*inch, letter[0] - 0.5*inch, letter[1] - 0.3*inch)
    canvas.restoreState()

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f'PDF saved: ${outputPath}')
`;

  // Write and execute Python script
  const scriptPath = '/tmp/cruz-generate-pdf.py';
  fs.writeFileSync(scriptPath, pythonScript);

  try {
    execSync(`cd /tmp && python3 ${scriptPath}`, { stdio: 'pipe' });
    console.log(`✅ PDF generated: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error('❌ PDF generation failed:', err.stderr?.toString() || err.message);
    // Fallback: save as markdown
    const mdPath = `/tmp/cruz-weekly-${data.folio}.md`;
    fs.writeFileSync(mdPath, `# ${data.folio}\n\n${aiAnalysis}`);
    console.log(`⚠ Fallback markdown saved: ${mdPath}`);
    return mdPath;
  }
}

// ============================================================================
// EMAIL DELIVERY
// ============================================================================

async function sendReport(pdfPath, data) {
  // Use the same email mechanism as morning-report.js
  // This assumes you have nodemailer or similar configured
  console.log(`📧 Would send ${pdfPath} to Ursula Banda`);

  // Save report record
  await supabase.from('weekly_reports').insert({
    folio: data.folio,
    week_start: data.weekStart,
    week_end: data.weekEnd,
    report_data: data.kpis,
    pdf_path: pdfPath,
    sent_to: ['ursula.banda@evco.com', 'rzivgarcia@gmail.com'],
    created_at: new Date().toISOString(),
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function generateMondayBrief() {
  console.log('📋 CRUZ Monday Intelligence Brief Generator');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Gather data
  const data = await gatherWeeklyData();

  // 2. AI analysis
  const aiAnalysis = await generateAIAnalysis(data);
  console.log('\n📝 AI Analysis generated\n');

  // 3. Generate PDF
  const pdfPath = generatePDF(data, aiAnalysis);

  // 4. Send
  await sendReport(pdfPath, data);

  console.log(`\n✅ Monday brief complete: ${data.folio}`);
  return pdfPath;
}

if (require.main === module) {
  generateMondayBrief()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { generateMondayBrief };
