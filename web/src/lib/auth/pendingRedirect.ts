/**
 * Pending Redirect Helper - Phase 4.95
 *
 * Stores a pending redirect URL in localStorage to survive auth flows.
 * Used for invite links that need to be resumed after login/signup/onboarding.
 *
 * Flow:
 * 1. User clicks invite link (not logged in)
 * 2. Invite page calls setPendingRedirect() before redirecting to login
 * 3. After auth completes (login/signup/onboarding), call consumePendingRedirect()
 * 4. If a pending redirect exists and hasn't expired, return it and clear storage
 */

const STORAGE_KEY = "dsc_pending_auth_redirect";
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

interface PendingRedirect {
  url: string;
  timestamp: number;
}

/**
 * Store a pending redirect URL. Called before redirecting to login/signup.
 */
export function setPendingRedirect(url: string): void {
  if (typeof window === "undefined") return;

  try {
    const data: PendingRedirect = {
      url,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
    console.warn("[PendingRedirect] Failed to store redirect URL");
  }
}

/**
 * Consume and return the pending redirect URL if it exists and hasn't expired.
 * Clears storage after reading.
 * Returns null if no pending redirect or if expired.
 */
export function consumePendingRedirect(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    // Always clear after reading (one-time use)
    localStorage.removeItem(STORAGE_KEY);

    const data: PendingRedirect = JSON.parse(stored);

    // Check expiry
    if (Date.now() - data.timestamp > EXPIRY_MS) {
      console.log("[PendingRedirect] Expired redirect discarded");
      return null;
    }

    return data.url;
  } catch {
    // Invalid JSON or other error
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Check if there's a pending redirect without consuming it.
 * Useful for UI decisions before auth is complete.
 */
export function hasPendingRedirect(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const data: PendingRedirect = JSON.parse(stored);
    return Date.now() - data.timestamp <= EXPIRY_MS;
  } catch {
    return false;
  }
}

/**
 * Clear any pending redirect. Called on explicit logout or error scenarios.
 */
export function clearPendingRedirect(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
