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
  const [isHost, setIsHost] = useState(false);
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

      // Check if user is a host or co-host of any event
      const { count: hostCount } = await supabase
        .from("event_hosts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: ownerCount } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("host_id", user.id);

      setIsHost(
        (hostCount != null && hostCount > 0) ||
          (ownerCount != null && ownerCount > 0) ||
          profile?.role === "admin"
      );

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
      | "email_admin_notifications"
      | "email_host_activity"
      | "email_attendee_activity"
      | "email_digests"
      | "email_invitations"
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
        {!loading && prefs && (
          <span
            data-testid="email-status-indicator"
            className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              prefs.email_enabled
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {prefs.email_enabled ? "Emails on" : "Emails off"}
          </span>
        )}
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
              {/* Category toggles */}
              <div
                className={`space-y-3 ${
                  masterOff ? "opacity-50" : ""
                }`}
              >
                {isHost && (
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
                )}

                {isHost && (
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <span className="text-[var(--color-text-primary)] text-sm">
                        Host activity
                      </span>
                      <p className="text-[var(--color-text-tertiary)] text-xs">
                        RSVPs, comments, and co-host updates on events you host
                      </p>
                    </div>
                    <Toggle
                      checked={prefs.email_host_activity}
                      disabled={masterOff}
                      saving={saving}
                      onChange={() =>
                        handleToggle(
                          "email_host_activity",
                          !prefs.email_host_activity
                        )
                      }
                    />
                  </label>
                )}

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-[var(--color-text-primary)] text-sm">
                      Attendee updates
                    </span>
                    <p className="text-[var(--color-text-tertiary)] text-xs">
                      Reminders and changes for events you&apos;re attending
                    </p>
                  </div>
                  <Toggle
                    checked={prefs.email_attendee_activity}
                    disabled={masterOff}
                    saving={saving}
                    onChange={() =>
                      handleToggle(
                        "email_attendee_activity",
                        !prefs.email_attendee_activity
                      )
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-[var(--color-text-primary)] text-sm">
                      Weekly digests
                    </span>
                    <p className="text-[var(--color-text-tertiary)] text-xs">
                      Open mic roundups and happenings digest
                    </p>
                  </div>
                  <Toggle
                    checked={prefs.email_digests}
                    disabled={masterOff}
                    saving={saving}
                    onChange={() =>
                      handleToggle(
                        "email_digests",
                        !prefs.email_digests
                      )
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-[var(--color-text-primary)] text-sm">
                      Invitations
                    </span>
                    <p className="text-[var(--color-text-tertiary)] text-xs">
                      Co-host invitations, event invitations, and collaboration requests
                    </p>
                  </div>
                  <Toggle
                    checked={prefs.email_invitations}
                    disabled={masterOff}
                    saving={saving}
                    onChange={() =>
                      handleToggle(
                        "email_invitations",
                        !prefs.email_invitations
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

              <p className="text-[var(--color-text-tertiary)] text-xs mt-2 italic">
                Security and account recovery emails are always delivered.
              </p>

              {/* Master kill-switch — red, at the bottom */}
              <div className="mt-4 pt-4 border-t border-red-500/30">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-red-500 dark:text-red-400 font-medium text-sm">
                      Stop all emails
                    </span>
                    <p className="text-red-400/70 dark:text-red-400/60 text-xs">
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
              </div>
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
