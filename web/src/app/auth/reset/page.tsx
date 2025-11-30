"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function submit() {
    setStatus("");
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("ok");
      setTimeout(() => router.push("/login?reset=success"), 1500);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-bold mb-4">Set your new password</h1>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        className="w-full border px-3 py-2 rounded bg-white text-black mb-3"
      />

      {status === "ok" ? (
        <p className="text-green-500">Your password has been updated!</p>
      ) : (
        <button
          onClick={submit}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Update password
        </button>
      )}

      {status && status !== "ok" && (
        <p className="text-red-500 mt-3">{status}</p>
      )}
    </div>
  );
}
