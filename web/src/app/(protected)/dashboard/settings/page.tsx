"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  getPreferences,
  upsertPreferences,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";

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
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

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

      // Load preferences
      const preferences = await getPreferences(supabase, user.id);
      setPrefs(preferences);
      setPrefsLoading(false);
    }

    loadData();
  }, [supabase]);

  // Handle preference toggle
  const handleToggle = async (key: keyof Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">, value: boolean) => {
    if (!userId || !prefs) return;

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
              {/* Master No-Emails Toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)] font-medium">No emails</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    Turn off all email notifications
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
                      ? "bg-[var(--color-accent-primary)]"
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

              {/* Category toggles - disabled when master is off */}
              <div className={`space-y-4 ${!prefs.email_enabled ? "opacity-50" : ""}`}>
              {/* Claim Updates Toggle */}
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

              {/* Event Updates Toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="text-[var(--color-text-primary)]">Event updates</span>
                  <p className="text-[var(--color-text-tertiary)] text-sm">
                    Weekly digest, reminders, and changes for events you&apos;re attending or hosting
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.email_event_updates}
                  onClick={() => handleToggle("email_event_updates", !prefs.email_event_updates)}
                  disabled={prefsSaving || !prefs.email_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.email_event_updates
                      ? "bg-[var(--color-accent-primary)]"
                      : "bg-[var(--color-bg-tertiary)]"
                  } ${prefsSaving ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.email_event_updates ? "translate-x-6" : "translate-x-1"
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

              {/* Saved confirmation */}
              {prefsSaved && (
                <p className="text-green-500 text-sm mt-4">
                  Saved. You&apos;ll still see all notifications in your dashboard.
                </p>
              )}
            </div>
          ) : (
            <div className="text-[var(--color-text-tertiary)]">Unable to load preferences.</div>
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
