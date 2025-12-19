/**
 * Guest Claim Storage
 *
 * Client-side localStorage helpers for guest claim status.
 * This is best-effort UX only, not a security mechanism.
 * Authorization is via the action token, not localStorage.
 */

const STORAGE_KEY_PREFIX = "dsc_guest_claim_";

export interface GuestClaimData {
  claim_id: string;
  guest_name: string;
  event_id: string;
  timeslot_id: string;
  slot_index: number;
  status: "confirmed" | "waitlist" | "offered";
  cancel_token?: string;
  created_at: string;
}

/**
 * Build storage key for an event
 */
function getStorageKey(eventId: string): string {
  return `${STORAGE_KEY_PREFIX}${eventId}`;
}

/**
 * Save guest claim data to localStorage
 */
export function saveGuestClaim(eventId: string, data: GuestClaimData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(eventId), JSON.stringify(data));
  } catch {
    // localStorage may be full or disabled
    console.warn("Failed to save guest claim to localStorage");
  }
}

/**
 * Get guest claim data from localStorage
 */
export function getGuestClaim(eventId: string): GuestClaimData | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(getStorageKey(eventId));
    if (!data) return null;
    return JSON.parse(data) as GuestClaimData;
  } catch {
    return null;
  }
}

/**
 * Remove guest claim data from localStorage
 */
export function removeGuestClaim(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(eventId));
  } catch {
    // Ignore errors
  }
}

/**
 * Get all guest claims from localStorage
 */
export function getAllGuestClaims(): GuestClaimData[] {
  if (typeof window === "undefined") return [];
  try {
    const claims: GuestClaimData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            claims.push(JSON.parse(data) as GuestClaimData);
          } catch {
            // Skip invalid data
          }
        }
      }
    }
    return claims;
  } catch {
    return [];
  }
}

/**
 * Clear all guest claims from localStorage
 */
export function clearAllGuestClaims(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore errors
  }
}
