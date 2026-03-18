"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  organizationId: string;
  organizationName: string;
  role: string;
}

export function RelinquishOrganizationButtonClient({
  organizationId,
  organizationName,
  role,
}: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleRelinquish = async () => {
    const confirmed = confirm(
      role === "owner"
        ? `Are you sure you want to relinquish owner access to "${organizationName}"?`
        : `Are you sure you want to relinquish manager access to "${organizationName}"?`
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/my-organizations/${organizationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to relinquish access");
        return;
      }
      router.refresh();
    } catch (error) {
      console.error("Relinquish organization access error:", error);
      alert("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleRelinquish}
      disabled={isLoading}
      className="px-3 py-1 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title={role === "owner" ? "Relinquish ownership" : "Relinquish manager access"}
    >
      {isLoading ? "Removing..." : "Relinquish"}
    </button>
  );
}
