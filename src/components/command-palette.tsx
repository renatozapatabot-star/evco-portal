'use client'
import { useState, useEffect, useRef, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutDashboard, Truck, Package, FileText,
         FolderOpen, BarChart3, MessageSquare, Mic, Shield, Link2,
         Building2, CreditCard, Table2, ArrowRight, Loader2,
         Tags, Warehouse, DollarSign } from 'lucide-react'

interface NavItem { id: string; label: string; sublabel: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; href: string; category: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',     sublabel: 'Inicio',        icon: LayoutDashboard, href: '/',            category: 'Navegación' },
  { id: 'cruz',        label: 'Asistente ZAPATA AI', sublabel: 'Asistente inteligente', icon: MessageSquare, href: '__cruz_chat__',       category: 'Navegación' },
  { id: 'voz',         label: 'Modo Voz',      sublabel: 'Control por voz', icon: Mic,           href: '/voz',         category: 'Navegación' },
  { id: 'traficos',    label: 'Embarques',      sublabel: 'Operaciones',   icon: Truck,           href: '/embarques',    category: 'Navegación' },
  { id: 'entradas',    label: 'Entradas',       sublabel: 'Remesas bodega',icon: Package,         href: '/entradas',    category: 'Navegación' },
  { id: 'pedimentos',  label: 'Pedimentos',     sublabel: 'Despachados',   icon: FileText,        href: '/pedimentos',  category: 'Navegación' },
  { id: 'expedientes', label: 'Expedientes',    sublabel: 'Documentos',    icon: FolderOpen,      href: '/expedientes', category: 'Navegación' },
  { id: 'reportes',    label: 'Reportes',       sublabel: 'Análisis',      icon: BarChart3,       href: '/reportes',    category: 'Navegación' },
  { id: 'cumplimiento', label: 'Cumplimiento', sublabel: 'Calendario compliance', icon: Shield,   href: '/cumplimiento', category: 'Navegación' },
  { id: 'cuentas',     label: 'Cuentas',        sublabel: 'eConta',        icon: CreditCard,      href: '/cuentas',     category: 'Navegación' },
  { id: 'anexo24',     label: 'Anexo 24',       sublabel: 'Control IMMEX',  icon: Table2,          href: '/anexo24',     category: 'Navegación' },
  { id: 'catalogo',    label: 'Catálogo',       sublabel: 'Fracciones arancelarias', icon: Tags,  href: '/catalogo',    category: 'Navegación' },
  { id: 'documentos',  label: 'Documentos',     sublabel: 'Archivo digital', icon: FileText,      href: '/documentos',  category: 'Navegación' },
  { id: 'bodega',      label: 'Bodega',         sublabel: 'Inventario',    icon: Warehouse,       href: '/bodega',      category: 'Navegación' },
  { id: 'financiero',  label: 'Financiero',     sublabel: 'Contabilidad',  icon: DollarSign,      href: '/financiero',  category: 'Navegación' },
  { id: 'facturacion', label: 'Facturación',    sublabel: 'Mis facturas',  icon: CreditCard,      href: '/facturacion', category: 'Navegación' },
  { id: 'inteligencia', label: 'Inteligencia',  sublabel: 'Corredor Laredo', icon: BarChart3,     href: '/inteligencia', category: 'Navegación' },
  { id: 'fracciones',  label: 'Fracciones',     sublabel: 'Búsqueda AI',   icon: Search,          href: '/fracciones',  category: 'Navegación' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [searchResults, setSearchResults] = useState<NavItem[]>([])
  const [searching, setSearching] = useState(false)
  const deferredQuery = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const toggle = () => { setOpen(p => !p); setQuery(''); setSelected(0); setSearchResults([]) }
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); toggle() }
      if (e.key === 'Escape') setOpen(false)
    }
    const eventHandler = () => toggle()
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('cruz:open-search', eventHandler)
    return () => { document.removeEventListener('keydown', keyHandler); document.removeEventListener('cruz:open-search', eventHandler) }
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  // Live Supabase search
  useEffect(() => {
    if (deferredQuery.length < 2) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(deferredQuery)}`, { signal: controller.signal })
        const data = await res.json()
        if (controller.signal.aborted) return
        const results: NavItem[] = []
        ;((data.traficos || []) as Array<Record<string, string>>).slice(0, 5).forEach((t) => {
          results.push({ id: `t-${t.trafico}`, label: t.trafico, sublabel: t.descripcion_mercancia?.slice(0, 40) || t.estatus || '', icon: Truck, href: `/embarques/${encodeURIComponent(t.trafico)}`, category: 'Embarques' })
        })
        ;((data.pedimentos || []) as Array<Record<string, string>>).slice(0, 3).forEach((p) => {
          results.push({ id: `p-${p.pedimento || p.referencia}`, label: p.pedimento || p.referencia, sublabel: p.proveedor || '', icon: FileText, href: '/pedimentos', category: 'Pedimentos' })
        })
        ;((data.proveedores || []) as Array<Record<string, string>>).slice(0, 3).forEach((s) => {
          results.push({ id: `s-${s.nombre || s.proveedor}`, label: s.nombre || s.proveedor, sublabel: s.pais || '', icon: Building2, href: '/proveedores', category: 'Proveedores' })
        })
        setSearchResults(results)
      } catch { /* aborted */ }
      setSearching(false)
    }, 250)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [deferredQuery])

  const allItems = [...NAV_ITEMS, ...searchResults]
  const filtered = allItems.filter(item => {
    if (!query) return item.category === 'Navegación'
    const q = query.toLowerCase()
    return item.label.toLowerCase().includes(q) || item.sublabel.toLowerCase().includes(q)
  })

  // Group by category
  const grouped = filtered.reduce<Record<string, NavItem[]>>((acc, item) => {
    ;(acc[item.category] = acc[item.category] || []).push(item)
    return acc
  }, {})
  const flatItems = Object.values(grouped).flat()

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(p => Math.min(p+1, flatItems.length-1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(p => Math.max(p-1, 0)) }
    else if (e.key === 'Enter' && flatItems[selected]) {
      const href = flatItems[selected].href
      if (href === '__cruz_chat__') { document.dispatchEvent(new CustomEvent('cruz:open-chat')) } else { router.push(href) }
      setOpen(false)
    }
  }

  if (!open) return null

  let itemIndex = -1

  return (
    <>
      <div className="cmd-overlay" onClick={() => setOpen(false)} aria-hidden />
      <div className="cmd-palette" role="dialog" aria-label="Buscar en CRUZ" aria-modal="true">
        <div className="cmd-search-row">
          <Search size={16} style={{ color: 'var(--n-400)', flexShrink: 0 }} />
          <input ref={inputRef} className="cmd-input" placeholder="Buscar embarque, pedimento, página..." value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }} onKeyDown={handleKey} />
          {searching && <Loader2 size={14} style={{ color: 'var(--n-400)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
          <kbd className="cmd-esc">ESC</kbd>
        </div>
        <div className="cmd-results" role="listbox">
          {flatItems.length === 0 && query ? (
            <div className="cmd-empty">{searching ? 'Buscando...' : `Sin resultados para "${query}"`}</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="cmd-cat-label">{category}</div>
                {items.map(item => {
                  itemIndex++
                  const idx = itemIndex
                  return (
                    <button key={item.id} className={`cmd-item ${idx === selected ? 'selected' : ''}`} onClick={() => { if (item.href === '__cruz_chat__') { document.dispatchEvent(new CustomEvent('cruz:open-chat')) } else { router.push(item.href) }; setOpen(false) }} onMouseEnter={() => setSelected(idx)} role="option" aria-selected={idx === selected}>
                      <item.icon size={15} style={{ color: 'var(--n-400)', flexShrink: 0 }} />
                      <span className="cmd-item-label">{item.label}</span>
                      <span className="cmd-item-sub">{item.sublabel}</span>
                      <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--n-300)', opacity: idx === selected ? 1 : 0, transition: 'opacity 100ms ease' }} />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="cmd-footer">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc cerrar</span>
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>g+t embarques · g+e entradas</span>
        </div>
      </div>
    </>
  )
}
