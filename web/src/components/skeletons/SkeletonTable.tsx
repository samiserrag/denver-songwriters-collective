interface Props {
  columns?: number;
  rows?: number;
}

export function SkeletonTable({ columns = 4, rows = 5 }: Props) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-white/10 p-4 bg-black/20 animate-pulse">
      <div className="min-w-full space-y-3">
        {/* Header */}
        <div className="flex gap-3 border-b border-white/10 pb-3">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1 h-4 bg-[var(--color-gold)]/20 rounded"></div>
          ))}
        </div>
        
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-3">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={colIdx} className="flex-1 h-3 bg-white/5 rounded"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
