export default function Loading() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-64 bg-[rgba(192,197,206,0.08)] rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-36 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
          <div className="h-36 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
          <div className="h-36 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
        </div>
        <div className="h-80 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
