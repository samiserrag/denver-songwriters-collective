import { SkeletonTable } from "@/components/skeletons";

export default function LoadingAdminEvents() {
  return <SkeletonTable columns={4} rows={10} />;
}
