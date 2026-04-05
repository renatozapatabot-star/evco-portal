import { Skeleton } from '@/components/ui/Skeleton'

export default function ProveedoresLoading() {
  return (
    <div style={{ padding: '32px 16px', maxWidth: 1200, margin: '0 auto' }}>
      <Skeleton variant="text" lines={2} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '24px 0' }}>
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="row" />
        ))}
      </div>
    </div>
  )
}
