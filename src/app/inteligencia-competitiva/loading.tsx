export default function Loading() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-56 bg-[rgba(192,197,206,0.08)] rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-28 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
          <div className="h-28 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
          <div className="h-28 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
          <div className="h-28 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
        </div>
        <div className="h-72 bg-[rgba(192,197,206,0.08)] rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
