"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function RoleOnboarding() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);

  async function selectRole(role: string) {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("profiles").update({ role }).eq("id", user.id);

    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white">
      <h1 className="text-3xl mb-6">Choose your role</h1>

      <div className="flex gap-4">
        <button
          disabled={loading}
          onClick={() => selectRole("performer")}
          className="px-6 py-3 bg-blue-600 rounded-lg"
        >
          Performer
        </button>

        <button
          disabled={loading}
          onClick={() => selectRole("organizer")}
          className="px-6 py-3 bg-green-600 rounded-lg"
        >
          Organizer
        </button>

        <button
          disabled={loading}
          onClick={() => selectRole("studio")}
          className="px-6 py-3 bg-purple-600 rounded-lg"
        >
          Studio
        </button>
      </div>
    </div>
  );
}
