"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  getPreferences,
  upsertPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";
import {
  hasSavedHappeningsFilters,
  sanitizeSavedHappeningsFilters,
  upsertUserSavedHappeningsFilters,
  getUserSavedHappeningsFilters,
  type SavedDayFilter,
  type SavedHappeningsFilters,
} from "@/lib/happenings/savedFilters";

const SAVED_FILTER_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "open_mic", label: "Open Mics" },
  { value: "shows", label: "Shows" },
  { value: "showcase", label: "Showcases" },
  { value: "gig", label: "Gigs" },
  { value: "workshop", label: "Workshops" },
  { value: "song_circle", label: "Song Circles" },
  { value: "jam_session", label: "Jam Sessions" },
  { value: "poetry", label: "Poetry" },
  { value: "irish", label: "Irish" },
  { value: "blues", label: "Blues" },
  { value: "bluegrass", label: "Bluegrass" },
  { value: "comedy", label: "Comedy" },
  { value: "other", label: "Other" },
] as const;

const SAVED_FILTER_DAY_OPTIONS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
] as const;

const SAVED_FILTER_COST_OPTIONS = [
  { value: "", label: "Any cost" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "unknown", label: "Unknown" },
] as const;

export default function SettingsPage() {
  const supabase = createClient();

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState("");

  // Notification preferences state
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedHappeningsFilters>({});
  const [savedFiltersAutoApply, setSavedFiltersAutoApply] = useState(false);
  const [savedFiltersLoading, setSavedFiltersLoading] = useState(true);
  const [savedFiltersSaving, setSavedFiltersSaving] = useState(false);
  const [savedFiltersSaved, setSavedFiltersSaved] = useState<string | null>(null);

  // Load user and preferences
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Check if admin
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

      // Load preferences
      const preferences = await getPreferences(supabase, user.id);
      setPrefs(preferences);
      setPrefsLoading(false);

      const saved = await getUserSavedHappeningsFilters(supabase, user.id);
      if (saved) {
        setSavedFilters(saved.filters);
        setSavedFiltersAutoApply(saved.autoApply);
      }
      setSavedFiltersLoading(false);
    }

    loadData();
  }, [supabase]);

  // Handle preference toggle
  const handleToggle = async (key: keyof Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">, value: boolean) => {
    if (!userId || !prefs) return;
    // Block category writes when master is off
    if (key !== "email_enabled" && !prefs.email_enabled) return;

    setPrefsSaving(true);
    setPrefsSaved(false);

    const updated = await upsertPreferences(supabase, userId, { [key]: value });
    if (updated) {
      setPrefs(updated);
      setPrefsSaved(true);
      // Clear saved message after 3 seconds
      setTimeout(() => setPrefsSaved(false), 3000);
    }

    setPrefsSaving(false);
  };

  const updateSavedFilters = (patch: Partial<SavedHappeningsFilters>) => {
    setSavedFilters((prev) => sanitizeSavedHappeningsFilters({ ...prev, ...patch }));
  };

  const toggleSavedDay = (day: string) => {
    const current = savedFilters.days || [];
    const normalizedDay = day as SavedDayFilter;
    const next = current.includes(normalizedDay)
      ? current.filter((d) => d !== normalizedDay)
      : [...current, normalizedDay];
    updateSavedFilters({ days: next });
  };

  const handleSaveSavedFilters = async () => {
    if (!userId) return;

    setSavedFiltersSaving(true);
    setSavedFiltersSaved(null);

    const updated = await upsertUserSavedHappeningsFilters(supabase, userId, {
      autoApply: savedFiltersAutoApply,
      filters: savedFilters,
    });

    if (updated) {
      setSavedFilters(updated.filters);
      setSavedFiltersAutoApply(updated.autoApply);
      setSavedFiltersSaved("Saved.");
    } else {
      setSavedFiltersSaved("Could not save. Try again.");
    }

    setSavedFiltersSaving(false);
  };

  const handleResetSavedFilters = async () => {
    if (!userId) return;

    setSavedFiltersSaving(true);
    setSavedFiltersSaved(null);

    const updated = await upsertUserSavedHappeningsFilters(supabase, userId, {
      autoApply: false,
      filters: {},
    });

    if (updated) {
      setSavedFilters(updated.filters);
      setSavedFiltersAutoApply(updated.autoApply);
      setSavedFiltersSaved("Saved filters reset.");
    } else {
      setSavedFiltersSaved("Could not reset. Try again.");
    }

    setSavedFiltersSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE MY ACCOUNT") {
      setError("Please type exactly: DELETE MY ACCOUNT");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("Not logged in");
        return;
      }

      // Delete user's profile data
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (profileError) {
        console.error("Profile delete error:", profileError);
        // Continue anyway - profile might not exist
      }

      // Delete user's event suggestions
      const { error: suggestionsError } = await supabase
        .from("event_update_suggestions")
        .delete()
        .eq("submitted_by", user.id);

      if (suggestionsError) {
        console.error("Suggestions delete error:", suggestionsError);
      }

      // Delete user's venue submissions
      const { error: venueError } = await supabase
        .from("venue_submissions")
        .delete()
        .eq("submitted_by", user.id);

      if (venueError) {
        console.error("Venue submissions delete error:", venueError);
      }

      // Delete user's favorites if table exists
      const { error: favoritesError } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id);

      if (favoritesError) {
        console.error("Favorites delete error:", favoritesError);
        // Continue with deletion - this is not critical
      }

      // Delete user's open mic claims if table exists
      const { error: claimsError } = await supabase
        .from("open_mic_claims")
        .delete()
        .eq("profile_id", user.id);

      if (claimsError) {
        console.error("Open mic claims delete error:", claimsError);
        // Continue with deletion - this is not critical
      }

      // Sign out the user (this ends their session)
      await supabase.auth.signOut();

      // Show success state
      setDeleteSuccess(true);

    } catch (err) {
      console.error("Delete account error:", err);
      setError("Failed to delete account. Please try again or contact support.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (deleteSuccess) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">✓</div>
          <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-4">
            Account Deleted
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Your account and all associated data have been permanently deleted.
            This action cannot be undone.
          </p>
          <p className="text-[var(--color-text-tertiary)] text-sm mb-8">
            You can now close this page or refresh your browser.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-8">Account Settings</h1>

        {/* Email Preferences */}
        <section className="mb-12 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Email Preferences</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-6">
            Turning off emails won&apos;t hide anything — these notifications still appear in your dashboard.
          </p>

          {prefsLoading ? (
            <div className="text-[var(--color-text-tertiary)]">Loading preferences...</div>
          ) : prefs ? (
            <div className="space-y-4">
              {/* Category toggles - disabled when master is off */}
              <div className={`space-y-4 ${!prefs.email_enabled ? "opacity-50" : ""}`}>
              {/* Claim Updates Toggle — host/co-host only */}
              {isHost && (
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)]">Event claim updates</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    When you submit, or we respond to, a host claim
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.email_claim_updates}
                  onClick={() => handleToggle("email_claim_updates", !prefs.email_claim_updates)}
                  disabled={prefsSaving || !prefs.email_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.email_claim_updates
                      ? "bg-[var(--color-accent-primary)]"
                      : "bg-[var(--color-bg-tertiary)]"
                  } ${prefsSaving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.email_claim_updates ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              )}

              {/* Host Activity Toggle — host/co-host only */}
              {isHost && (
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)]">Host activity</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    RSVPs, comments, and co-host updates on events you host
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.email_host_activity}
                  onClick={() => handleToggle("email_host_activity", !prefs.email_host_activity)}
                  disabled={prefsSaving || !prefs.email_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.email_host_activity
                      ? "bg-[var(--color-accent-primary)]"
                      : "bg-[var(--color-bg-tertiary)]"
                  } ${prefsSaving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.email_host_activity ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              )}

              {/* Attendee Updates Toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)]">Attendee updates</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    Reminders and changes for events you&apos;re attending
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.email_attendee_activity}
                  onClick={() => handleToggle("email_attendee_activity", !prefs.email_attendee_activity)}
                  disabled={prefsSaving || !prefs.email_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.email_attendee_activity
                      ? "bg-[var(--color-accent-primary)]"
                      : "bg-[var(--color-bg-tertiary)]"
                  } ${prefsSaving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.email_attendee_activity ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {/* Weekly Digests Toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)]">Weekly digests</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    Open mic roundups and happenings digest
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.email_digests}
                  onClick={() => handleToggle("email_digests", !prefs.email_digests)}
                  disabled={prefsSaving || !prefs.email_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.email_digests
                      ? "bg-[var(--color-accent-primary)]"
                      : "bg-[var(--color-bg-tertiary)]"
                  } ${prefsSaving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.email_digests ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {/* Invitations Toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)]">Invitations</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    Co-host invitations, event invitations, and collaboration requests
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.email_invitations}
                  onClick={() => handleToggle("email_invitations", !prefs.email_invitations)}
                  disabled={prefsSaving || !prefs.email_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.email_invitations
                      ? "bg-[var(--color-accent-primary)]"
                      : "bg-[var(--color-bg-tertiary)]"
                  } ${prefsSaving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.email_invitations ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {/* Admin Notifications Toggle - only show to admins */}
              {isAdmin && (
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-[var(--color-text-primary)]">Admin alerts</span>
                    <p className="text-[var(--color-text-tertiary)] text-sm">
                      Notifications about claims, submissions, and community activity
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.email_admin_notifications}
                    onClick={() => handleToggle("email_admin_notifications", !prefs.email_admin_notifications)}
                    disabled={prefsSaving || !prefs.email_enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      prefs.email_admin_notifications
                        ? "bg-[var(--color-accent-primary)]"
                        : "bg-[var(--color-bg-tertiary)]"
                    } ${prefsSaving ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        prefs.email_admin_notifications ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              )}
              </div>

              <p className="text-[var(--color-text-tertiary)] text-xs mt-2 italic">
                Security and account recovery emails are always delivered.
              </p>

              {/* Saved confirmation */}
              {prefsSaved && (
                <p className="text-green-500 text-sm mt-4">
                  Saved. You&apos;ll still see all notifications in your dashboard.
                </p>
              )}

              {/* Master kill-switch — red, at the bottom */}
              <div className="mt-4 pt-4 border-t border-red-500/30">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-red-500 dark:text-red-400 font-medium">Stop all emails</span>
                    <p className="text-red-400/70 dark:text-red-400/60 text-sm">
                      Disable every email from this site
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!prefs.email_enabled}
                    onClick={() => handleToggle("email_enabled", !prefs.email_enabled)}
                    disabled={prefsSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      !prefs.email_enabled
                        ? "bg-red-500"
                        : "bg-[var(--color-bg-tertiary)]"
                    } ${prefsSaving ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        !prefs.email_enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          ) : (
            <div className="text-[var(--color-text-tertiary)]">Unable to load preferences.</div>
          )}
        </section>

        {/* Saved Happenings Filters */}
        <section className="mb-12 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Saved Happenings Filters</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mb-6">
            Save your filter preferences once. Use one-click apply on Happenings, or turn on auto-apply for every visit.
          </p>

          {savedFiltersLoading ? (
            <div className="text-[var(--color-text-tertiary)]">Loading saved filters...</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-4 space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">1. Choose what to save</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-sm text-[var(--color-text-secondary)]">Type</span>
                    <select
                      value={savedFilters.type || ""}
                      onChange={(e) => updateSavedFilters({ type: e.target.value || undefined })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                    >
                      {SAVED_FILTER_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-[var(--color-text-secondary)]">Cost</span>
                    <select
                      value={savedFilters.cost || ""}
                      onChange={(e) =>
                        updateSavedFilters({
                          cost: (e.target.value || undefined) as SavedHappeningsFilters["cost"],
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                    >
                      {SAVED_FILTER_COST_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="inline-flex items-start gap-2 cursor-pointer text-sm text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={savedFilters.csc === true}
                    onChange={(e) => updateSavedFilters({ csc: e.target.checked ? true : undefined })}
                    className="mt-0.5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
                  />
                  <span>Prioritize CSC-only happenings on the Happenings page</span>
                </label>

                <div className="space-y-2">
                  <span className="text-sm text-[var(--color-text-secondary)]">Days</span>
                  <div className="flex flex-wrap gap-2">
                    {SAVED_FILTER_DAY_OPTIONS.map((day) => {
                      const active = (savedFilters.days || []).includes(day.value as SavedDayFilter);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleSavedDay(day.value)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            active
                              ? "bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                              : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-4 space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">2. Set location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-1">
                    <span className="text-sm text-[var(--color-text-secondary)]">City</span>
                    <input
                      type="text"
                      value={savedFilters.city || ""}
                      disabled={Boolean(savedFilters.zip)}
                      onChange={(e) =>
                        updateSavedFilters({
                          city: e.target.value || undefined,
                          zip: undefined,
                        })
                      }
                      placeholder="Denver"
                      className={`w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)] ${
                        savedFilters.zip ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-[var(--color-text-secondary)]">ZIP</span>
                    <input
                      type="text"
                      value={savedFilters.zip || ""}
                      onChange={(e) =>
                        updateSavedFilters({
                          zip: e.target.value || undefined,
                          city: undefined,
                        })
                      }
                      placeholder="80202"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-[var(--color-text-secondary)]">Radius</span>
                    <select
                      value={savedFilters.radius || "10"}
                      disabled={!savedFilters.city && !savedFilters.zip}
                      onChange={(e) => updateSavedFilters({ radius: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] ${
                        !savedFilters.city && !savedFilters.zip ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <option value="5">5 miles</option>
                      <option value="10">10 miles</option>
                      <option value="25">25 miles</option>
                      <option value="50">50 miles</option>
                    </select>
                  </label>
                </div>
                <p className="text-[var(--color-text-tertiary)] text-xs">
                  Tip: enter either City or ZIP. If both are entered, ZIP will be used.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">3. Choose recall method</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSavedFiltersAutoApply(false)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      !savedFiltersAutoApply
                        ? "bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    One-click Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavedFiltersAutoApply(true)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      savedFiltersAutoApply
                        ? "bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                        : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    Auto-open
                  </button>
                </div>
                <p className="text-[var(--color-text-tertiary)] text-xs">
                  One-click lets you apply saved filters when you want. Auto-open applies them automatically when Happenings opens with no URL filters.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-4 space-y-3">
                <p className="text-[var(--color-text-tertiary)] text-xs">
                  Weekly digest personalization uses your saved type, day, cost, and location filters. CSC-only is excluded from digest personalization.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSaveSavedFilters}
                    disabled={savedFiltersSaving}
                    className="px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:opacity-90 transition disabled:opacity-50"
                  >
                    {savedFiltersSaving ? "Saving..." : "Save Filters"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSavedFilters}
                    disabled={savedFiltersSaving}
                    className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                  >
                    Reset
                  </button>
                  {savedFiltersSaved && (
                    <span className="text-sm text-[var(--color-text-secondary)] self-center">
                      {savedFiltersSaved}
                    </span>
                  )}
                </div>

                {!hasSavedHappeningsFilters(savedFilters) && (
                  <p className="text-[var(--color-text-tertiary)] text-xs">
                    No saved filters yet. Save at least one filter to personalize your weekly digest.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Privacy Link */}
        <section className="mb-12 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Privacy</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Learn how we handle your data.
          </p>
          <Link
            href="/privacy"
            className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)] underline"
          >
            Read our Privacy Policy →
          </Link>
        </section>

        {/* Danger Zone */}
        <section className="p-6 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-500/30 rounded-lg">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-2">Danger Zone</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Permanently delete your account and all associated data.
            This action cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)] rounded-lg transition-colors"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-500/30 rounded-lg">
                <p className="text-red-800 dark:text-red-400 font-medium mb-2">
                  This will permanently delete:
                </p>
                <ul className="text-red-800 dark:text-red-400 text-sm space-y-1 ml-4">
                  <li>• Your account and login</li>
                  <li>• Your profile information</li>
                  <li>• All suggestions you&apos;ve submitted</li>
                  <li>• All venue submissions</li>
                  <li>• Your favorites and claims</li>
                </ul>
              </div>

              <div>
                <label className="block text-[var(--color-text-secondary)] text-sm mb-2">
                  Type <strong className="text-[var(--color-text-primary)]">DELETE MY ACCOUNT</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="w-full px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-red-500 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText !== "DELETE MY ACCOUNT"}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 text-[var(--color-text-primary)] rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting..." : "Permanently Delete Account"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setError("");
                  }}
                  className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
