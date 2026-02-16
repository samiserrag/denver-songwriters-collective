"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getPreferences,
  upsertPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";

function Toggle({
  checked,
  disabled,
  saving,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  saving?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled || saving}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked
          ? "bg-[var(--color-accent-primary)]"
          : "bg-[var(--color-bg-tertiary)]"
      } ${disabled || saving ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function EmailPreferencesSection() {
  const searchParams = useSearchParams();
  const forceOpen = searchParams.get("emailPrefs") === "1";

  const [open, setOpen] = useState(forceOpen);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);

  const supabase = createClient();

  // Scroll into view once when opened via deep link
  useEffect(() => {
    if (forceOpen && open && !didScrollRef.current) {
      didScrollRef.current = true;
      requestAnimationFrame(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [forceOpen, open]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");

      const preferences = await getPreferences(supabase, user.id);
      setPrefs(preferences);
      setLoading(false);
    }

    load();
  }, [supabase]);

  const handleToggle = async (
    key: keyof Pick<
      NotificationPreferences,
      | "email_enabled"
      | "email_claim_updates"
      | "email_event_updates"
      | "email_admin_notifications"
    >,
    value: boolean
  ) => {
    if (!userId || !prefs) return;
    // Block category writes when master is off
    if (key !== "email_enabled" && !prefs.email_enabled) return;

    setSaving(true);
    setSaved(false);

    const updated = await upsertPreferences(supabase, userId, {
      [key]: value,
    });
    if (updated) {
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }

    setSaving(false);
  };

  const masterOff = prefs ? !prefs.email_enabled : false;

  return (
    <div
      id="email-preferences"
      ref={sectionRef}
      className="mt-4 border-t border-[var(--color-border-default)] pt-4"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors w-full"
      >
        <span
          className={`transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▸
        </span>
        <span>Email preferences</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[var(--color-text-tertiary)] text-xs">
            Dashboard notifications will still appear.
          </p>

          {loading ? (
            <div className="text-[var(--color-text-tertiary)] text-sm">
              Loading...
            </div>
          ) : prefs ? (
            <div className="space-y-3">
              {/* Master toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)] font-medium">
                    Stop all emails
                  </span>
                  <p className="text-[var(--color-text-tertiary)] text-xs">
                    Disable every email from this site
                  </p>
                </div>
                <Toggle
                  checked={!prefs.email_enabled}
                  saving={saving}
                  onChange={() =>
                    handleToggle("email_enabled", !prefs.email_enabled)
                  }
                />
              </label>

              {/* Category toggles */}
              <div
                className={`space-y-3 pl-2 border-l-2 border-[var(--color-border-default)] ${
                  masterOff ? "opacity-50" : ""
                }`}
              >
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-[var(--color-text-primary)] text-sm">
                      Event claim updates
                    </span>
                    <p className="text-[var(--color-text-tertiary)] text-xs">
                      When you submit, or we respond to, a host claim
                    </p>
                  </div>
                  <Toggle
                    checked={prefs.email_claim_updates}
                    disabled={masterOff}
                    saving={saving}
                    onChange={() =>
                      handleToggle(
                        "email_claim_updates",
                        !prefs.email_claim_updates
                      )
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-[var(--color-text-primary)] text-sm">
                      Event updates
                    </span>
                    <p className="text-[var(--color-text-tertiary)] text-xs">
                      Weekly digest, reminders, and changes for events
                      you&apos;re attending or hosting
                    </p>
                  </div>
                  <Toggle
                    checked={prefs.email_event_updates}
                    disabled={masterOff}
                    saving={saving}
                    onChange={() =>
                      handleToggle(
                        "email_event_updates",
                        !prefs.email_event_updates
                      )
                    }
                  />
                </label>

                {isAdmin && (
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <span className="text-[var(--color-text-primary)] text-sm">
                        Admin alerts
                      </span>
                      <p className="text-[var(--color-text-tertiary)] text-xs">
                        Notifications about claims, submissions, and community
                        activity
                      </p>
                    </div>
                    <Toggle
                      checked={prefs.email_admin_notifications}
                      disabled={masterOff}
                      saving={saving}
                      onChange={() =>
                        handleToggle(
                          "email_admin_notifications",
                          !prefs.email_admin_notifications
                        )
                      }
                    />
                  </label>
                )}
              </div>

              {saved && (
                <p className="text-green-500 text-xs">Saved.</p>
              )}
            </div>
          ) : (
            <div className="text-[var(--color-text-tertiary)] text-sm">
              Unable to load preferences.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
