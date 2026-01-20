/**
 * Sort profile images with avatar photo first, then remaining by newest-first.
 *
 * @param images - Array of profile images with id, image_url, and created_at
 * @param avatarUrl - Current avatar URL from profile (may be null)
 * @returns Sorted array with avatar image first (if found), then rest newest-first
 */
export function sortProfileImagesAvatarFirst<
  T extends { id: string; image_url: string; created_at: string }
>(images: T[], avatarUrl: string | null): T[] {
  if (!images || images.length === 0) return [];

  // Find the avatar image (if it exists in the gallery)
  const avatarIndex = avatarUrl
    ? images.findIndex((img) => img.image_url === avatarUrl)
    : -1;

  if (avatarIndex === -1) {
    // No avatar in gallery, just sort by created_at descending (newest first)
    return [...images].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Avatar exists: put it first, then rest sorted by created_at desc
  const avatarImage = images[avatarIndex];
  const otherImages = images
    .filter((_, idx) => idx !== avatarIndex)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return [avatarImage, ...otherImages];
}
