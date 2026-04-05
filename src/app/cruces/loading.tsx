import { Skeleton } from '@/components/ui/Skeleton'

export default function CrucesLoading() {
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1000, margin: '0 auto' }}>
      <Skeleton variant="text" lines={2} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, margin: '24px 0' }}>
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
        <Skeleton variant="stat" />
      </div>
      <Skeleton variant="card" />
    </div>
  )
}
