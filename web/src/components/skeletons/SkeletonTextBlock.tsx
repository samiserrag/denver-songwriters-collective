interface Props {
  lines?: number;
}

export function SkeletonTextBlock({ lines = 3 }: Props) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-white/10 rounded"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        ></div>
      ))}
    </div>
  );
}
