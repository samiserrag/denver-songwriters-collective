"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function WelcomeToast() {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome");

  useEffect(() => {
    if (welcome === "1") {
      toast.success("Your email has been confirmed — welcome!");
    }

    const google = searchParams.get("google");
    if (google === "1") {
      toast.success("Logged in with Google!");
    }
  }, [welcome]);

  // Magic-link login success toast
  const magic = searchParams.get("magic");
  useEffect(() => {
    if (magic === "1") {
      toast.success("Logged in via magic link!");
    }
  }, [magic]);

  return null;
}
