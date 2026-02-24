import { canonicalizeMediaReference, classifyUrl, MediaEmbedValidationError } from "@/lib/mediaEmbeds";

export interface MusicProfileImportInput {
  youtube_url?: string | null;
  spotify_url?: string | null;
  bandcamp_url?: string | null;
}

export interface MusicProfileImportWarning {
  field: "youtube_url" | "spotify_url" | "bandcamp_url";
  url: string;
  reason: string;
}

export interface MusicProfileImportResult {
  importableUrls: string[];
  warnings: MusicProfileImportWarning[];
}

const IMPORT_FIELDS: Array<keyof MusicProfileImportInput> = [
  "youtube_url",
  "spotify_url",
  "bandcamp_url",
];

export function getEmbeddableMediaImportsFromMusicProfiles(
  input: MusicProfileImportInput,
  existingUrls: string[]
): MusicProfileImportResult {
  const warnings: MusicProfileImportWarning[] = [];
  const importableUrls: string[] = [];
  const seenKeys = new Set<string>();

  for (const existing of existingUrls) {
    const key = canonicalizeMediaReference(existing);
    if (key) seenKeys.add(key.toLowerCase());
  }

  for (const field of IMPORT_FIELDS) {
    const raw = input[field]?.trim();
    if (!raw) continue;

    try {
      const classified = classifyUrl(raw);

      if (classified.provider === "external" || !classified.embed_url) {
        warnings.push({
          field,
          url: raw,
          reason: "Profile links display as cards. Use a direct video/track/playlist URL to embed a player.",
        });
        continue;
      }

      const key = canonicalizeMediaReference(raw);
      if (!key) {
        warnings.push({
          field,
          url: raw,
          reason: "Could not normalize this URL for embedding.",
        });
        continue;
      }

      const lowerKey = key.toLowerCase();
      if (seenKeys.has(lowerKey)) continue;

      seenKeys.add(lowerKey);
      importableUrls.push(raw);
    } catch (error) {
      warnings.push({
        field,
        url: raw,
        reason: error instanceof MediaEmbedValidationError ? error.message : "Invalid media URL.",
      });
    }
  }

  return { importableUrls, warnings };
}

