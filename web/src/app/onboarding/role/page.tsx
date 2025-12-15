"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RoleOption = {
  value: string;
  label: string;
  description: string;
  icon: string;
  color: string;
};

const roleOptions: RoleOption[] = [
  {
    value: "performer",
    label: "Performer",
    description: "Musicians, singers, and songwriters looking to play at open mics and events",
    icon: "🎤",
    color: "from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600",
  },
  {
    value: "host",
    label: "Open Mic Host",
    description: "You host or organize open mic nights and want to manage your events",
    icon: "🎯",
    color: "from-green-600 to-green-700 hover:from-green-500 hover:to-green-600",
  },
  {
    value: "studio",
    label: "Studio",
    description: "Recording studios offering services to the Denver music community",
    icon: "🎧",
    color: "from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600",
  },
  {
    value: "fan",
    label: "Supporter / Fan",
    description: "Music lovers who want to discover local artists and support the community",
    icon: "❤️",
    color: "from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600",
  },
];

export default function RoleOnboarding() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  async function selectRole(role: string) {
    setLoading(true);
    setError(null);
    setSelectedRole(role);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to select a role. Please log in and try again.");
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", user.id);

      if (updateError) {
        console.error("Role update error:", updateError);
        setError("Failed to save your role. Please try again.");
        setLoading(false);
        return;
      }

      // Success - refresh to clear cache, then redirect to onboarding profile step
      router.refresh();
      router.push("/onboarding/profile");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-4">
          Welcome to Denver Songwriters Collective
        </h1>
        <p className="text-[var(--color-text-secondary)] text-lg">
          Tell us a bit about yourself so we can personalize your experience.
        </p>
      </div>

      <div className="max-w-2xl w-full">
        <h2 className="text-xl text-[var(--color-text-primary)] mb-6 text-center">
          Which best describes you?
        </h2>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleOptions.map((option) => (
            <button
              key={option.value}
              disabled={loading}
              onClick={() => selectRole(option.value)}
              className={`
                relative p-6 rounded-xl text-left transition-all duration-200
                bg-gradient-to-br ${option.color}
                border border-white/10
                ${loading && selectedRole === option.value ? "opacity-70" : ""}
                ${loading && selectedRole !== option.value ? "opacity-50 cursor-not-allowed" : ""}
                disabled:cursor-not-allowed
              `}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{option.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {option.label}
                  </h3>
                  <p className="text-sm text-white/80">
                    {option.description}
                  </p>
                </div>
              </div>
              {loading && selectedRole === option.value && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">
          Don&apos;t worry, you can change this later in your profile settings.
        </p>
      </div>
    </div>
  );
}
