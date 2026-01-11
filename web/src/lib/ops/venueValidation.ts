/**
 * Venue Row Validation
 *
 * Ops Console v1: Row-level validation for venue CSV imports.
 * Update-only (no creates) - validates existing venue IDs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VenueRowValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface VenueRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website_url: string | null;
  phone: string | null;
  google_maps_url: string | null;
  notes: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single venue row from CSV.
 *
 * Validation rules:
 * - id: Required, must be valid UUID format
 * - name: Required, non-empty after trim
 * - address, city, state, zip, phone, notes: Optional (no validation)
 * - website_url: If present, must be http/https URL
 * - google_maps_url: If present, must be http/https URL
 */
export function validateVenueRow(
  row: Record<string, string>
): VenueRowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // id: Required, UUID format
  if (!row.id || row.id.trim() === "") {
    errors.push("Missing required field: id");
  } else if (!isValidUuid(row.id.trim())) {
    errors.push(`Invalid UUID format for id: "${row.id}"`);
  }

  // name: Required, non-empty
  if (!row.name || row.name.trim() === "") {
    errors.push("Missing required field: name");
  }

  // website_url: If present, must be http/https
  if (row.website_url && row.website_url.trim() !== "") {
    if (!isValidHttpUrl(row.website_url)) {
      errors.push(
        `Invalid website_url: "${row.website_url}" (must start with http:// or https://)`
      );
    }
  }

  // google_maps_url: If present, must be http/https
  if (row.google_maps_url && row.google_maps_url.trim() !== "") {
    if (!isValidHttpUrl(row.google_maps_url)) {
      errors.push(
        `Invalid google_maps_url: "${row.google_maps_url}" (must start with http:// or https://)`
      );
    }
  }

  // Warnings (non-blocking)
  if (!row.city || row.city.trim() === "") {
    warnings.push("Missing city");
  }
  if (!row.state || row.state.trim() === "") {
    warnings.push("Missing state");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a venue row:
 * - Trims all string values
 * - Converts empty strings to null
 */
export function normalizeVenueRow(
  row: Record<string, string>
): VenueRow {
  const normalize = (value: string | undefined): string | null => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  return {
    id: row.id?.trim() || "",
    name: row.name?.trim() || "",
    address: normalize(row.address),
    city: normalize(row.city),
    state: normalize(row.state),
    zip: normalize(row.zip),
    website_url: normalize(row.website_url),
    phone: normalize(row.phone),
    google_maps_url: normalize(row.google_maps_url),
    notes: normalize(row.notes),
  };
}

/**
 * Validates and normalizes a batch of venue rows.
 * Returns validation results per row.
 */
export function validateVenueRows(
  rows: Record<string, string>[]
): {
  validRows: VenueRow[];
  invalidRows: { rowIndex: number; row: Record<string, string>; validation: VenueRowValidation }[];
  allValid: boolean;
} {
  const validRows: VenueRow[] = [];
  const invalidRows: { rowIndex: number; row: Record<string, string>; validation: VenueRowValidation }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = validateVenueRow(row);

    if (validation.valid) {
      validRows.push(normalizeVenueRow(row));
    } else {
      invalidRows.push({ rowIndex: i + 1, row, validation }); // 1-indexed for user display
    }
  }

  return {
    validRows,
    invalidRows,
    allValid: invalidRows.length === 0,
  };
}
