import { NextResponse } from "next/server";
import { isGuestVerificationDisabled } from "@/lib/guest-verification/config";

/**
 * GET /api/health/guest-verification
 *
 * Health check endpoint for guest verification system.
 * Returns the current state of guest verification.
 *
 * Response:
 * - enabled: true (default, always-on)
 * - enabled: false (only if DISABLE_GUEST_VERIFICATION=true kill switch is set)
 * - mode: "always-on" | "disabled" (for debugging)
 */
export async function GET() {
  const isDisabled = isGuestVerificationDisabled();

  return NextResponse.json({
    enabled: !isDisabled,
    mode: isDisabled ? "disabled" : "always-on",
    // Include timestamp for cache-busting verification
    timestamp: new Date().toISOString(),
  });
}
