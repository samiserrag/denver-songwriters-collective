export function SkeletonCard() {
  return (
    <div className="card-base p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-3"></div>
      <div className="h-3 bg-white/5 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-white/5 rounded w-2/3"></div>
    </div>
  );
}
