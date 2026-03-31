import { Skeleton } from '@/components/ui/Skeleton'

export default function TraficosLoading() {
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <Skeleton variant="stat" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 }}>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    </div>
  )
}
