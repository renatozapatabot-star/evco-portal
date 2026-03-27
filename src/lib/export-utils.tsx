'use client'

export function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) { alert('No hay datos para exportar'); return }
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]; if (val === null || val === undefined) return ''
      const str = String(val)
      return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str
    }).join(','))
  ]
  const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
}

export function ExportButton({ data, filename, label = 'Exportar CSV' }: { data: any[]; filename: string; label?: string }) {
  return (
    <button onClick={() => downloadCSV(data, filename)}
      style={{ background: 'none', border: '1px solid #E6E3DC', borderRadius: 7, padding: '6px 12px',
        color: '#68635A', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F2F1EE' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
      ⬇️ {label}
    </button>
  )
}
