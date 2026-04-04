export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="animate-pulse space-y-6">
        <div className="h-12 bg-muted rounded-lg w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
