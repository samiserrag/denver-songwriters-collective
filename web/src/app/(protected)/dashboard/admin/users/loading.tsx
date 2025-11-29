import { SkeletonTable } from "@/components/skeletons";

export default function LoadingAdminUsers() {
  return <SkeletonTable columns={4} rows={12} />;
}
