import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { loadPdfRenderer } from '../src/lib/pdf/lazy'
import { OcaPDF } from '../src/app/api/oca/[id]/pdf/pdf-document'
import type { OcaRow } from '../src/lib/oca/types'

const opinion: OcaRow = {
  id: 'sample-2026-04-20',
  opinion_number: 'OCA-2026-SAMPLE',
  company_id: 'evco',
  trafico_id: null,
  product_description:
    'Lámina de policarbonato transparente, grado óptico, espesor 3 mm, ' +
    'presentación en hojas rectangulares 1220×2440 mm. Uso: inyección y ' +
    'termoformado para piezas plásticas industriales EVCO Plastics.',
  fraccion_recomendada: '3907.40.04',
  pais_origen: 'Estados Unidos de América',
  uso_final:
    'Materia prima industrial — moldeo por inyección y termoformado en ' +
    'planta EVCO Guadalupe, NL.',
  fundamento_legal:
    'Clasificación determinada conforme a las Reglas Generales de ' +
    'Interpretación (RGI) 1 y 6 de la LIGIE. El producto es un ' +
    'policarbonato en forma primaria presentado en láminas rectangulares ' +
    'sin trabajar ulteriormente, lo que corresponde a la partida 39.07, ' +
    'subpartida 3907.40 "Policarbonatos". La fracción arancelaria ' +
    '3907.40.04 aplica por tratarse de láminas/placas de policarbonato ' +
    'en formas primarias, conforme a las Notas Explicativas de la TIGIE y ' +
    'las RGCE vigentes para el año en curso.',
  nom_aplicable: null,
  tmec_elegibilidad: true,
  vigencia_hasta: '2026-12-31T23:59:59-06:00',
  model_used: null,
  input_tokens: null,
  output_tokens: null,
  cost_usd: null,
  generated_by: 'Renato Zapata IV',
  approved_by: 'Renato Zapata III',
  approved_at: '2026-04-20T12:00:00-05:00',
  pdf_url: null,
  status: 'approved',
  created_at: '2026-04-20T12:00:00-05:00',
  updated_at: '2026-04-20T12:00:00-05:00',
}

const razonamiento =
  'La mercancía es policarbonato en forma primaria (láminas sin ' +
  'mecanizar, sin imprimir, sin recubrir). Aplica RGI 1 — la partida ' +
  '39.07 cubre "Poliacetales, los demás poliéteres y resinas epoxi, en ' +
  'formas primarias; policarbonatos, resinas alcídicas, poliésteres ' +
  'alílicos y demás poliésteres, en formas primarias". La subpartida ' +
  '3907.40 es específica para policarbonatos. La fracción 3907.40.04 ' +
  'corresponde a láminas y placas de policarbonato, diferenciándose de ' +
  'la fracción base 3907.40.01 por su forma de presentación. T-MEC: ' +
  'elegible por regla de origen de capítulo 39 si cumple con cambio ' +
  'arancelario requerido y el certificado USMCA 2026 está vigente.'

async function main() {
  const { renderToBuffer } = await loadPdfRenderer()
  const buffer = await renderToBuffer(OcaPDF({ opinion, razonamiento }))
  const out = join(homedir(), 'Desktop', 'OCA-sample-2026-04-20.pdf')
  writeFileSync(out, buffer)
  console.log(`Wrote ${buffer.length.toLocaleString()} bytes → ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
