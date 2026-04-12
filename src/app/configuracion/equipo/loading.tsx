export default function Loading() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-4">
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-12 w-40 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}
