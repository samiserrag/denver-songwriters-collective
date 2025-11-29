import { SkeletonTextBlock, SkeletonGridSection } from "@/components/skeletons";

export default function LoadingEventDetail() {
  return (
    <div className="px-6 py-20 max-w-4xl mx-auto">
      <SkeletonTextBlock lines={4} />
      <div className="mt-10">
        <SkeletonGridSection title="Loading Slots…" count={4} />
      </div>
    </div>
  );
}
