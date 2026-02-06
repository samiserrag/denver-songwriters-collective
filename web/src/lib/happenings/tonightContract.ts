/**
 * Phase 6: Cross-Surface Consistency Contract
 *
 * Canonical constants shared by all discovery surfaces (homepage, /happenings, digest).
 * Any surface that displays events to users for "tonight" or general discovery
 * MUST use these shared values to ensure consistency.
 *
 * See: docs/investigation/phase6-cross-surface-consistency-stopgate.md
 * Checked against DSC UX Principles §4 (Centralize Logic), §5 (Previews Must Match Reality)
 */

/**
 * Canonical status filter for all discovery surfaces.
 *
 * Homepage, /happenings, and any future discovery surface MUST use this array
 * when filtering events for public display.
 *
 * - "active": Standard published events
 * - "needs_verification": Events imported/seeded that still need admin verification
 * - "unverified": Events from community submissions not yet verified
 *
 * Note: The weekly digest intentionally uses "active" only — this is an allowed
 * divergence documented in the cross-surface consistency rules.
 */
export const DISCOVERY_STATUS_FILTER = [
  "active",
  "needs_verification",
  "unverified",
] as const;

/**
 * PostgREST venue join select for discovery surfaces.
 *
 * Uses singular alias `venue:` so the result is `event.venue` (object),
 * NOT `event.venues` (array). Components like HappeningCard read
 * `event.venue.city` / `event.venue.state`, which requires this alias.
 *
 * Includes all fields needed by HappeningCard and SeriesCard:
 * - id, slug: for internal venue links (/venues/[slug])
 * - name, address: primary display
 * - city, state: decision fact (must never be silently hidden)
 * - google_maps_url, website_url: action buttons
 *
 * Note: /happenings also includes latitude, longitude for map view.
 * Homepage omits these since it has no map view.
 */
export const DISCOVERY_VENUE_SELECT =
  "venue:venues!left(id, slug, name, address, city, state, google_maps_url, website_url)";

/**
 * Extended venue select including coordinates (for surfaces with map view).
 */
export const DISCOVERY_VENUE_SELECT_WITH_COORDS =
  "venue:venues!left(id, slug, name, address, city, state, google_maps_url, website_url, latitude, longitude)";
