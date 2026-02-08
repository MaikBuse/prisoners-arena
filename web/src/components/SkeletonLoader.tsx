export function SkeletonLoader({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <SkeletonLoader className="h-6 w-32" />
      <SkeletonLoader className="h-4 w-48" />
      <SkeletonLoader className="h-20 w-full" />
      <div className="flex gap-4">
        <SkeletonLoader className="h-8 w-24" />
        <SkeletonLoader className="h-8 w-24" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLoader key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
