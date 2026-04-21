import { Skeleton } from '@/components/ui/Skeleton'

export default function LaunchpadLoading() {
  return (
    <div style={{ padding: '20px 24px', maxWidth: 720, margin: '0 auto' }}>
      <Skeleton variant="row" />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 20,
        }}
      >
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <div style={{ marginTop: 32 }}>
        <Skeleton variant="text" lines={4} />
      </div>
    </div>
  )
}
