import { Skeleton } from '@/components/ui/Skeleton'

export default function PedimentosLoading() {
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <Skeleton variant="text" lines={2} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '16px 0' }}>
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 16 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} variant="row" />
        ))}
      </div>
    </div>
  )
}
