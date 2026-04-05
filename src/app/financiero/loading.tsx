import { Skeleton } from '@/components/ui/Skeleton'

export default function FinancieroLoading() {
  return (
    <div style={{ padding: '32px 16px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Skeleton variant="text" lines={2} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
      </div>
      <Skeleton variant="card" />
    </div>
  )
}
