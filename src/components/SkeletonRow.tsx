interface SkeletonRowProps {
  columns: number
  rows?: number
}

export function SkeletonRow({ columns, rows = 8 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ height: 44 }}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} style={{ padding: '0 14px' }}>
              <div
                className="skeleton"
                style={{
                  height: 14,
                  width: j === 0 ? '80%' : j === columns - 1 ? '60%' : '70%',
                  borderRadius: 4,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
