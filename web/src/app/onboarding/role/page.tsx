"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type IdentityOption = {
  key: "is_songwriter" | "is_studio" | "is_host" | "is_fan";
  label: string;
  description: string;
  icon: string;
};

const identityOptions: IdentityOption[] = [
  {
    key: "is_songwriter",
    label: "I'm a Songwriter",
    description: "Musicians, singers, and songwriters looking to play at open mics and events",
    icon: "🎤",
  },
  {
    key: "is_studio",
    label: "I run a Studio",
    description: "Recording studios offering services to the Denver music community",
    icon: "🎧",
  },
  {
    key: "is_host",
    label: "I host Open Mics",
    description: "You host or organize open mic nights and want to manage your events",
    icon: "🎯",
  },
  {
    key: "is_fan",
    label: "I'm a Fan/Supporter",
    description: "Music lovers who want to discover local artists and support the community",
    icon: "❤️",
  },
];

export default function RoleOnboarding() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleOption(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleContinue() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in. Please log in and try again.");
        setLoading(false);
        return;
      }

      // Build update object with selected identity flags
      const updates: Record<string, boolean> = {};
      for (const option of identityOptions) {
        updates[option.key] = selected.has(option.key);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        setError("Failed to save your selections. Please try again.");
        setLoading(false);
        return;
      }

      // Success - refresh to clear cache, then redirect to profile step
      router.refresh();
      router.push("/onboarding/profile");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function handleSkip() {
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-4">
          Welcome to Denver Songwriters Collective
        </h1>
        <p className="text-[var(--color-text-secondary)] text-lg">
          Tell us about yourself (optional)
        </p>
      </div>

      <div className="max-w-2xl w-full">
        <h2 className="text-xl text-[var(--color-text-primary)] mb-6 text-center">
          Select all that apply
        </h2>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {identityOptions.map((option) => {
            const isSelected = selected.has(option.key);
            return (
              <button
                key={option.key}
                type="button"
                disabled={loading}
                onClick={() => toggleOption(option.key)}
                className={`
                  relative p-6 rounded-xl text-left transition-all duration-200
                  border-2
                  ${
                    isSelected
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent-primary)]/50"
                  }
                  ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{option.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                        {option.label}
                      </h3>
                      <div
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-[var(--color-text-on-accent)]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="px-8 py-3 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading}
            className="px-8 py-3 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
          You can change these anytime in your profile settings.
        </p>
      </div>
    </div>
  );
}
