/**
 * CRUZ Knowledge Graph
 *
 * Builds an in-memory relationship graph from tráficos + facturas data.
 * Enables ADUANA AI to answer "how are X and Y connected?" without
 * manually joining across multiple tables.
 *
 * No Supabase tables — computed per request from fresh data.
 * The relationships between data are more valuable than the data itself.
 */

// ── Types ──

export interface GraphNode {
  id: string
  type: 'client' | 'supplier' | 'product' | 'fraccion' | 'carrier' | 'regulation'
  name: string
  properties: Record<string, unknown>
}

export interface GraphEdge {
  source: string
  target: string
  relationship: string
  weight: number
  properties: Record<string, unknown>
}

export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
}

interface TraficoInput {
  trafico?: string
  company_id?: string | null
  proveedores?: string | null
  descripcion_mercancia?: string | null
  transportista_mexicano?: string | null
  transportista_extranjero?: string | null
  pedimento?: string | null
  regimen?: string | null
  estatus?: string | null
  fecha_cruce?: string | null
  importe_total?: number | null
  [k: string]: unknown
}

interface FacturaInput {
  pedimento?: string | null
  proveedor?: string | null
  igi?: number | null
  dta?: number | null
  valor_usd?: number | null
  [k: string]: unknown
}

// ── Helpers ──

function normalizeId(type: string, name: string): string {
  return `${type}:${name.toLowerCase().trim().replace(/\s+/g, '_')}`
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function addNode(graph: KnowledgeGraph, id: string, type: GraphNode['type'], name: string, props: Record<string, unknown> = {}): void {
  if (!graph.nodes.has(id)) {
    graph.nodes.set(id, { id, type, name, properties: props })
  }
}

function addEdge(graph: KnowledgeGraph, source: string, target: string, relationship: string, props: Record<string, unknown> = {}): void {
  const existing = graph.edges.find(e => e.source === source && e.target === target && e.relationship === relationship)
  if (existing) {
    existing.weight++
    Object.assign(existing.properties, props)
  } else {
    graph.edges.push({ source, target, relationship, weight: 1, properties: props })
  }
}

// ── Graph Builder ──

export function buildGraph(traficos: TraficoInput[], facturas: FacturaInput[]): KnowledgeGraph {
  const graph: KnowledgeGraph = { nodes: new Map(), edges: [] }

  // Add regulation nodes
  addNode(graph, 'regulation:tmec', 'regulation', 'T-MEC/USMCA', { description: 'Tratado entre México, EUA y Canadá' })
  addNode(graph, 'regulation:immex', 'regulation', 'IMMEX', { description: 'Industria Manufacturera, Maquiladora y de Servicios de Exportación' })

  for (const t of traficos) {
    const companyId = t.company_id || 'unknown'
    const clientNodeId = normalizeId('client', companyId)
    addNode(graph, clientNodeId, 'client', companyId, {})

    // Suppliers
    const suppliers = (t.proveedores || '').split(',').map(s => s.trim()).filter(Boolean)
    for (const sup of suppliers) {
      const supId = normalizeId('supplier', sup)
      addNode(graph, supId, 'supplier', normalizeName(sup), {})
      addEdge(graph, supId, clientNodeId, 'SUPPLIES', {})

      // Product
      if (t.descripcion_mercancia) {
        const desc = normalizeName(t.descripcion_mercancia).substring(0, 60)
        const prodId = normalizeId('product', desc)
        addNode(graph, prodId, 'product', desc, {})
        addEdge(graph, supId, prodId, 'PROVIDES', {})
        addEdge(graph, clientNodeId, prodId, 'IMPORTS', { value: t.importe_total })
      }
    }

    // Carriers
    const carrier = t.transportista_mexicano || t.transportista_extranjero
    if (carrier && carrier.trim()) {
      const carrierId = normalizeId('carrier', carrier)
      addNode(graph, carrierId, 'carrier', normalizeName(carrier), {})
      addEdge(graph, carrierId, clientNodeId, 'TRANSPORTS_FOR', {})
    }

    // T-MEC relationship
    const regimen = (t.regimen || '').toUpperCase()
    if (regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD') {
      if (t.descripcion_mercancia) {
        const prodId = normalizeId('product', normalizeName(t.descripcion_mercancia).substring(0, 60))
        addEdge(graph, prodId, 'regulation:tmec', 'BENEFITS_FROM', {})
      }
    }
    if (regimen === 'IMD' || regimen === 'ITE' || regimen === 'ITR') {
      addEdge(graph, clientNodeId, 'regulation:immex', 'OPERATES_UNDER', {})
    }
  }

  // Facturas: add fraccion data if available
  for (const f of facturas) {
    if (f.proveedor) {
      const supId = normalizeId('supplier', f.proveedor)
      addNode(graph, supId, 'supplier', normalizeName(f.proveedor), {})

      if (f.igi === 0 || f.igi === null) {
        addEdge(graph, supId, 'regulation:tmec', 'TMEC_SUPPLIER', {})
      }
    }
  }

  return graph
}

// ── Graph Query ──

export function queryGraph(graph: KnowledgeGraph, entity: string, entityType?: string, relatedTo?: string): string {
  const searchTerm = entity.toLowerCase().trim()

  // Find matching nodes
  const matches: GraphNode[] = []
  for (const node of graph.nodes.values()) {
    if (entityType && node.type !== entityType) continue
    if (node.name.toLowerCase().includes(searchTerm) || node.id.includes(searchTerm)) {
      matches.push(node)
    }
  }

  if (matches.length === 0) {
    return `No se encontró "${entity}" en el grafo de conocimiento. Entidades disponibles: ${graph.nodes.size} nodos, ${graph.edges.length} relaciones.`
  }

  const node = matches[0]
  const outEdges = graph.edges.filter(e => e.source === node.id)
  const inEdges = graph.edges.filter(e => e.target === node.id)

  const lines: string[] = [`**${node.name}** (${node.type})`]

  // If looking for connection to another entity
  if (relatedTo) {
    const targetTerm = relatedTo.toLowerCase().trim()
    const targetNodes: GraphNode[] = []
    for (const n of graph.nodes.values()) {
      if (n.name.toLowerCase().includes(targetTerm) || n.id.includes(targetTerm)) {
        targetNodes.push(n)
      }
    }

    if (targetNodes.length > 0) {
      const target = targetNodes[0]
      // Direct connections
      const direct = [...outEdges.filter(e => e.target === target.id), ...inEdges.filter(e => e.source === target.id)]
      if (direct.length > 0) {
        lines.push(`\nConexión directa con ${target.name}:`)
        for (const e of direct) {
          lines.push(`  → ${e.relationship} (peso: ${e.weight})`)
        }
      } else {
        // Find 2-hop path
        const midNodes = new Set<string>()
        for (const e1 of [...outEdges, ...inEdges]) {
          const mid = e1.source === node.id ? e1.target : e1.source
          const midOut = graph.edges.filter(e => e.source === mid && e.target === target.id)
          const midIn = graph.edges.filter(e => e.target === mid && e.source === target.id)
          if (midOut.length > 0 || midIn.length > 0) midNodes.add(mid)
        }
        if (midNodes.size > 0) {
          lines.push(`\nConexión indirecta con ${target.name} (2 saltos):`)
          for (const mid of Array.from(midNodes).slice(0, 5)) {
            const midNode = graph.nodes.get(mid)
            lines.push(`  → vía ${midNode?.name || mid} (${midNode?.type})`)
          }
        } else {
          lines.push(`\nSin conexión directa ni indirecta con ${target.name}.`)
        }
      }
      return lines.join('\n')
    }
  }

  // General exploration: list all connections
  if (outEdges.length > 0) {
    lines.push('\nRelaciones salientes:')
    const grouped = new Map<string, { targets: string[]; weight: number }>()
    for (const e of outEdges) {
      const key = e.relationship
      const entry = grouped.get(key) || { targets: [], weight: 0 }
      const targetNode = graph.nodes.get(e.target)
      entry.targets.push(targetNode?.name || e.target)
      entry.weight += e.weight
      grouped.set(key, entry)
    }
    for (const [rel, data] of grouped) {
      const targets = data.targets.slice(0, 5).join(', ')
      const more = data.targets.length > 5 ? ` (+${data.targets.length - 5} más)` : ''
      lines.push(`  ${rel}: ${targets}${more} (peso: ${data.weight})`)
    }
  }

  if (inEdges.length > 0) {
    lines.push('\nRelaciones entrantes:')
    const grouped = new Map<string, { sources: string[]; weight: number }>()
    for (const e of inEdges) {
      const key = e.relationship
      const entry = grouped.get(key) || { sources: [], weight: 0 }
      const sourceNode = graph.nodes.get(e.source)
      entry.sources.push(sourceNode?.name || e.source)
      entry.weight += e.weight
      grouped.set(key, entry)
    }
    for (const [rel, data] of grouped) {
      const sources = data.sources.slice(0, 5).join(', ')
      const more = data.sources.length > 5 ? ` (+${data.sources.length - 5} más)` : ''
      lines.push(`  ${rel}: ${sources}${more} (peso: ${data.weight})`)
    }
  }

  return lines.join('\n')
}

// ── Graph Summary ──

export function graphSummary(graph: KnowledgeGraph): string {
  const byType = new Map<string, number>()
  for (const node of graph.nodes.values()) {
    byType.set(node.type, (byType.get(node.type) || 0) + 1)
  }

  const parts: string[] = []
  if (byType.get('supplier')) parts.push(`${byType.get('supplier')} proveedores`)
  if (byType.get('product')) parts.push(`${byType.get('product')} productos`)
  if (byType.get('carrier')) parts.push(`${byType.get('carrier')} transportistas`)

  // Top supplier by edge weight
  let topSupplier = ''
  let topWeight = 0
  for (const node of graph.nodes.values()) {
    if (node.type !== 'supplier') continue
    const weight = graph.edges.filter(e => e.source === node.id || e.target === node.id).reduce((s, e) => s + e.weight, 0)
    if (weight > topWeight) { topWeight = weight; topSupplier = node.name }
  }

  if (topSupplier) parts.push(`principal: ${topSupplier} (${topWeight} conexiones)`)

  return `Grafo: ${graph.nodes.size} nodos, ${graph.edges.length} relaciones. ${parts.join(' · ')}`
}
