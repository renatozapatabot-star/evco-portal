import { Skeleton } from '@/components/ui/Skeleton'

export default function CruzLoading() {
  return (
    <div style={{ padding: '32px 16px', maxWidth: 720, margin: '0 auto' }}>
      <Skeleton variant="text" lines={3} />
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  )
}
