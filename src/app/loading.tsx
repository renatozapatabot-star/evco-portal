export default function Loading() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="z-mark-pulse">
        <div style={{
          width: 48, height: 48, borderRadius: 12, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1A1710',
        }} className="z-mark-coin">Z</div>
      </div>
    </div>
  )
}
