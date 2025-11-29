import { SkeletonTextBlock, SkeletonGridSection } from "@/components/skeletons";

export default function LoadingPerformerDetail() {
  return (
    <div className="px-6 py-20 max-w-4xl mx-auto">
      <SkeletonTextBlock lines={4} />
      <div className="mt-10">
        <SkeletonGridSection title="Loading Performances…" count={4} />
      </div>
    </div>
  );
}
