import { SkeletonCard } from "./SkeletonCard";

interface Props {
  title?: string;
  count?: number;
}

export function SkeletonGridSection({ title = "Loading…", count = 8 }: Props) {
  return (
    <div className="px-6 py-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[var(--color-gold)] opacity-50">
          {title}
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
