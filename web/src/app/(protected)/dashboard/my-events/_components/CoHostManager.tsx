"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LeaveEventButton } from "@/components/events/LeaveEventButton";

interface Host {
  id: string;
  user_id: string;
  role: string;
  invitation_status: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface CoHostManagerProps {
  eventId: string;
  eventTitle: string;
  hosts: Host[];
  /** Current user's ID for leave button */
  currentUserId?: string;
  /** Current user's role */
  currentUserRole?: "host" | "cohost";
  /** Whether the current user is the only host */
  isSoleHost?: boolean;
}

interface SearchResult {
  id: string;
  name: string | null;
}

export default function CoHostManager({
  eventId,
  eventTitle,
  hosts,
  currentUserId,
  currentUserRole,
  isSoleHost = false,
}: CoHostManagerProps) {
  const router = useRouter();
  const [inviteMode, setInviteMode] = useState<"search" | "email" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);

  const acceptedHosts = hosts.filter(h => h.invitation_status === "accepted");
  const pendingInvites = hosts.filter(h => h.invitation_status === "pending");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");
    setSearchResults([]);

    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_name: searchQuery })
      });

      const data = await res.json();

      if (res.ok) {
        // Successfully invited
        setSearchQuery("");
        setInviteMode(null);
        setSuccess("Invitation sent!");
        router.refresh();
        setTimeout(() => setSuccess(""), 3000);
      } else if (data.multiple_matches) {
        // Show results to pick from
        setSearchResults(data.multiple_matches);
      } else {
        setError(data.error || "Failed to send invitation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMember = async (userId: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (res.ok) {
        setSearchQuery("");
        setSearchResults([]);
        setInviteMode(null);
        setSuccess("Invitation sent!");
        router.refresh();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to send invitation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this co-host?")) return;

    setError("");
    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Co-host removed");
        router.refresh();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to remove co-host");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove co-host");
    }
  };

  const handleCancelInvite = async (userId: string) => {
    if (!confirm("Cancel this invitation?")) return;

    setError("");
    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Invitation cancelled");
        router.refresh();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to cancel invitation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invitation");
    }
  };

  const cancelInvite = () => {
    setInviteMode(null);
    setSearchQuery("");
    setSearchResults([]);
    setInviteEmail("");
    setShowEmailTemplate(false);
    setError("");
  };

  // Pre-written email template for non-members
  const emailSubject = `Invitation to co-host "${eventTitle}" on Denver Songwriters Collective`;
  const emailBody = `Hi there!

I'd like to invite you to co-host "${eventTitle}" with me on the Denver Songwriters Collective website.

To accept this invitation:
1. Go to https://denversongwriterscollective.org/signup
2. Create a free account using this email address (${inviteEmail || "[their email]"})
3. Once you're signed up, let me know and I'll send you a co-host invitation through the site

The Denver Songwriters Collective is a community platform for Denver-area songwriters to discover open mics, connect with musicians, and stay informed about local music events.

Looking forward to hosting with you!

Best,
[Your name]`;

  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(inviteEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const mailtoUrl = `mailto:${inviteEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="space-y-4">
      {/* Permissions help block */}
      {currentUserRole && (
        <div className="p-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-sm">
          {currentUserRole === "cohost" ? (
            <p className="text-[var(--color-text-secondary)]">
              You can invite other co-hosts, edit the event, and leave anytime. Only a primary host can remove co-hosts.
            </p>
          ) : (
            <p className="text-[var(--color-text-secondary)]">
              You can invite, remove, and leave. If you leave, another host will be auto-promoted.
            </p>
          )}
          <Link
            href="/feedback"
            className="text-[var(--color-text-accent)] hover:underline text-xs mt-2 inline-block"
          >
            Need admin help?
          </Link>
        </div>
      )}

      {/* Error message */}
      {error && inviteMode === null && (
        <div className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-800 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded text-green-800 dark:text-green-300 text-sm">
          {success}
        </div>
      )}

      {/* Current hosts */}
      <ul className="space-y-2">
        {acceptedHosts.map((host) => (
          <li key={host.id} className="flex items-center justify-between p-2 bg-[var(--color-bg-secondary)] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded-full flex items-center justify-center text-sm">
                {host.user?.avatar_url ? (
                  <Image src={host.user.avatar_url} alt="" width={32} height={32} className="w-full h-full rounded-full object-cover" />
                ) : (
                  host.user?.full_name?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <div>
                <p className="text-[var(--color-text-primary)] text-sm">{host.user?.full_name || "Unknown"}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {host.role === "host" ? "Primary Host" : "Co-host"}
                </p>
              </div>
            </div>
            {/* Only primary hosts can remove cohosts */}
            {host.role === "cohost" && currentUserRole === "host" && (
              <button
                onClick={() => handleRemove(host.user_id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div>
          <h4 className="text-sm text-[var(--color-text-secondary)] mb-2">Pending Invitations</h4>
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between p-2 bg-[var(--color-accent-primary)]/10 border border-[var(--color-border-accent)] rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-primary)] text-sm">{invite.user?.full_name || "Unknown"}</span>
                  <span className="text-xs text-[var(--color-text-accent)]">Pending</span>
                </div>
                <button
                  onClick={() => handleCancelInvite(invite.user_id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite options */}
      {inviteMode === null ? (
        <div className="space-y-2">
          <button
            onClick={() => setInviteMode("search")}
            className="w-full px-3 py-2 border border-dashed border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm rounded-lg transition-colors"
          >
            + Invite existing member
          </button>
          <button
            onClick={() => setInviteMode("email")}
            className="w-full px-3 py-2 border border-dashed border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm rounded-lg transition-colors"
          >
            ✉️ Invite someone new (via email)
          </button>
        </div>
      ) : inviteMode === "search" ? (
        <div className="space-y-3">
          <form onSubmit={handleSearch}>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchResults([]); // Clear results when typing
                }}
                placeholder="Search member by name..."
                className="flex-1 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] text-sm"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="px-3 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] text-sm rounded-lg disabled:opacity-50"
              >
                {loading ? "..." : "Search"}
              </button>
            </div>
          </form>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
              <p className="px-3 py-2 bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)]">
                Select a member to invite:
              </p>
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectMember(result.id)}
                  disabled={loading}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] border-t border-[var(--color-border-default)] first:border-t-0 disabled:opacity-50"
                >
                  {result.name || "Unknown"}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={cancelInvite}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Back
          </button>
        </div>
      ) : (
        // Email invite mode
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Invite someone who isn&apos;t a member yet. They&apos;ll need to sign up first.
          </p>

          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter their email address..."
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] text-sm"
            autoFocus
          />

          {inviteEmail && (
            <div className="space-y-2">
              <button
                onClick={() => setShowEmailTemplate(!showEmailTemplate)}
                className="text-sm text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)]"
              >
                {showEmailTemplate ? "Hide" : "Preview"} email template
              </button>

              {showEmailTemplate && (
                <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-sm">
                  <p className="text-[var(--color-text-secondary)] mb-1">Subject:</p>
                  <p className="text-[var(--color-text-primary)] mb-3">{emailSubject}</p>
                  <p className="text-[var(--color-text-secondary)] mb-1">Body:</p>
                  <pre className="text-[var(--color-text-primary)] whitespace-pre-wrap text-xs font-sans">
                    {emailBody}
                  </pre>
                </div>
              )}

              <div className="flex gap-2">
                <a
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] text-sm rounded-lg"
                >
                  Open in Gmail
                </a>
                <a
                  href={mailtoUrl}
                  className="px-3 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm rounded-lg"
                >
                  Open in Mail App
                </a>
              </div>

              <p className="text-xs text-[var(--color-text-tertiary)]">
                After they sign up, come back here and search for their name to send the official invitation.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={cancelInvite}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Leave event button for all hosts */}
      {currentUserId && currentUserRole && (
        <div className="mt-6 pt-4 border-t border-[var(--color-border-default)]">
          <LeaveEventButton
            eventId={eventId}
            eventTitle={eventTitle}
            userRole={currentUserRole}
            userId={currentUserId}
            isSoleHost={currentUserRole === "host" ? isSoleHost : false}
          />
        </div>
      )}
    </div>
  );
}
