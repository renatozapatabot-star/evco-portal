export default function Loading() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-3">
          <div className="h-10 w-72 bg-white/5 rounded-lg animate-pulse" />
          <div className="flex gap-4">
            <div className="h-6 w-28 bg-white/5 rounded animate-pulse" />
            <div className="h-6 w-28 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
