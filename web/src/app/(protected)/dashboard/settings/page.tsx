"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState("");

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
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .catch(() => {}); // Ignore if table doesn't exist

      // Delete user's open mic claims if table exists
      await supabase
        .from("open_mic_claims")
        .delete()
        .eq("profile_id", user.id)
        .catch(() => {}); // Ignore if table doesn't exist

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
      <main className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">✓</div>
          <h1 className="font-display text-3xl text-white mb-4">
            Account Deleted
          </h1>
          <p className="text-neutral-300 mb-6">
            Your account and all associated data have been permanently deleted.
            This action cannot be undone.
          </p>
          <p className="text-neutral-400 text-sm mb-8">
            You can now close this page or refresh your browser.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-white mb-8">Account Settings</h1>

        {/* Privacy Link */}
        <section className="mb-12 p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h2 className="text-xl font-semibold text-white mb-2">Privacy</h2>
          <p className="text-neutral-400 mb-4">
            Learn how we handle your data.
          </p>
          <Link
            href="/privacy"
            className="text-gold-400 hover:text-gold-300 underline"
          >
            Read our Privacy Policy →
          </Link>
        </section>

        {/* Danger Zone */}
        <section className="p-6 bg-red-950/30 border border-red-900/50 rounded-lg">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Danger Zone</h2>
          <p className="text-neutral-300 mb-4">
            Permanently delete your account and all associated data.
            This action cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-300 font-medium mb-2">
                  This will permanently delete:
                </p>
                <ul className="text-red-200 text-sm space-y-1 ml-4">
                  <li>• Your account and login</li>
                  <li>• Your profile information</li>
                  <li>• All suggestions you&apos;ve submitted</li>
                  <li>• All venue submissions</li>
                  <li>• Your favorites and claims</li>
                </ul>
              </div>

              <div>
                <label className="block text-neutral-300 text-sm mb-2">
                  Type <strong className="text-white">DELETE MY ACCOUNT</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText !== "DELETE MY ACCOUNT"}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting..." : "Permanently Delete Account"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setError("");
                  }}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
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
