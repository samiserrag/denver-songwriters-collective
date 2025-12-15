"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PageContainer } from "@/components/layout";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/");
    }
    run();
  }, [router]);

  return (
    <PageContainer as="main" className="min-h-screen flex items-center justify-center">
      <p className="text-[var(--color-text-secondary)]">
        Signing you out...
      </p>
    </PageContainer>
  );
}
