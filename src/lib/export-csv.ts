export function exportCSV(data: Record<string, any>[], columns: { key: string; label: string }[], filename: string) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => {
    const v = row[c.key]
    if (v == null) return ''
    return String(v).replace(/,/g, ' ').replace(/\n/g, ' ')
  }))
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `evco_${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
