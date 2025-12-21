"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { revalidatePath } from "next/cache";
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from "@/lib/auth/adminAuth";

// ============================================
// Types for deletion audit logging
// ============================================

interface BucketStats {
  attempted: number;
  deleted: number;
  failed: number;
}

interface StorageFailure {
  bucket: string;
  path: string;
  error: string;
}

interface DeletionLogEntry {
  actor_user_id: string | null;
  target_user_id: string;
  actor_is_admin: boolean;
  actor_is_super_admin: boolean;
  target_was_admin: boolean;
  mode: "admin_delete" | "self_delete";
  buckets: Record<string, BucketStats>;
  failures: StorageFailure[];
  status: "success" | "partial_success" | "failed";
  notes: string | null;
}

// ============================================
// Helper functions
// ============================================

/**
 * Extracts storage path from a Supabase storage URL.
 * Example: https://xyz.supabase.co/storage/v1/object/public/gallery-images/abc123.jpg
 * Returns: "abc123.jpg"
 */
function extractStoragePath(url: string, bucket: string): string | null {
  const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
  const match = url.match(pattern);
  return match ? match[1] : null;
}

/**
 * Deletes storage objects with individual error tracking.
 * Returns stats and failures for audit logging.
 */
async function deleteStorageObjectsResilient(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  bucket: string,
  paths: string[]
): Promise<{ stats: BucketStats; failures: StorageFailure[] }> {
  const stats: BucketStats = { attempted: paths.length, deleted: 0, failed: 0 };
  const failures: StorageFailure[] = [];

  if (paths.length === 0) {
    return { stats, failures };
  }

  // Try batch delete first (more efficient)
  const { error: batchError } = await serviceClient.storage
    .from(bucket)
    .remove(paths);

  if (!batchError) {
    // All succeeded
    stats.deleted = paths.length;
    return { stats, failures };
  }

  // Batch failed - try individual deletes to identify specific failures
  console.error(`Batch delete failed for ${bucket}, trying individual deletes:`, batchError);

  for (const path of paths) {
    try {
      const { error } = await serviceClient.storage.from(bucket).remove([path]);
      if (error) {
        stats.failed++;
        failures.push({ bucket, path, error: error.message });
      } else {
        stats.deleted++;
      }
    } catch (err) {
      stats.failed++;
      failures.push({
        bucket,
        path,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { stats, failures };
}

/**
 * Collects all storage paths for a user across all buckets.
 */
async function collectUserStoragePaths(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  userId: string
): Promise<{ bucket: string; paths: string[] }[]> {
  const result: { bucket: string; paths: string[] }[] = [];

  // 1. Avatars - stored as {userId}/avatar.{ext}
  const { data: avatarFiles } = await serviceClient.storage
    .from("avatars")
    .list(userId);

  if (avatarFiles && avatarFiles.length > 0) {
    result.push({
      bucket: "avatars",
      paths: avatarFiles.map((f) => `${userId}/${f.name}`),
    });
  }

  // 2. Gallery images
  const { data: galleryImages } = await serviceClient
    .from("gallery_images")
    .select("image_url")
    .eq("uploaded_by", userId);

  if (galleryImages && galleryImages.length > 0) {
    const paths = galleryImages
      .map((img) => extractStoragePath(img.image_url, "gallery-images"))
      .filter((p): p is string => p !== null);
    if (paths.length > 0) {
      result.push({ bucket: "gallery-images", paths });
    }
  }

  // 3. Blog images
  const { data: blogPosts } = await serviceClient
    .from("blog_posts")
    .select("cover_image_url")
    .eq("author_id", userId);

  if (blogPosts && blogPosts.length > 0) {
    const paths = blogPosts
      .filter((post) => post.cover_image_url)
      .map((post) => extractStoragePath(post.cover_image_url!, "blog-images"))
      .filter((p): p is string => p !== null);
    if (paths.length > 0) {
      result.push({ bucket: "blog-images", paths });
    }
  }

  // 4. Event images
  const { data: events } = await serviceClient
    .from("events")
    .select("cover_image_url")
    .eq("host_id", userId);

  if (events && events.length > 0) {
    const paths = events
      .filter((evt) => evt.cover_image_url)
      .map((evt) => extractStoragePath(evt.cover_image_url!, "event-images"))
      .filter((p): p is string => p !== null);
    if (paths.length > 0) {
      result.push({ bucket: "event-images", paths });
    }
  }

  return result;
}

/**
 * Inserts a deletion audit log entry.
 */
async function insertDeletionLog(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  entry: DeletionLogEntry
): Promise<void> {
  // Use type assertion for JSONB fields
  const logEntry = {
    actor_user_id: entry.actor_user_id,
    target_user_id: entry.target_user_id,
    actor_is_admin: entry.actor_is_admin,
    actor_is_super_admin: entry.actor_is_super_admin,
    target_was_admin: entry.target_was_admin,
    mode: entry.mode,
    buckets: JSON.parse(JSON.stringify(entry.buckets)),
    failures: JSON.parse(JSON.stringify(entry.failures)),
    status: entry.status,
    notes: entry.notes,
  };

  const { error } = await serviceClient.from("user_deletion_log").insert(logEntry);

  if (error) {
    console.error("Failed to insert deletion log:", error);
    // Don't throw - logging failure shouldn't block deletion
  }
}

// ============================================
// Exported actions
// ============================================

export async function toggleAdminRole(
  userId: string,
  makeAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Verify the current user is authenticated and is the super admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  if (!isSuperAdmin(user.email)) {
    return { success: false, error: "Only the super admin can promote/demote admins" };
  }

  // Prevent demoting yourself
  if (userId === user.id && !makeAdmin) {
    return { success: false, error: "Cannot demote yourself" };
  }

  // Get target user info
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();

  if (!targetProfile) {
    return { success: false, error: "User not found" };
  }

  // Update the role (non-admins use 'member', identity flags drive UX)
  const newRole = makeAdmin ? "admin" : "member";
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) {
    console.error("Toggle admin role error:", error);
    return { success: false, error: `Failed to update role: ${error.message}` };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

/**
 * Deletes a user and ALL their associated data including:
 * - All database records (via FK CASCADE)
 * - Storage objects (avatars, gallery images, blog images, event images)
 * - Auth account (auth.users)
 *
 * Logs all deletions to user_deletion_log for audit.
 *
 * SAFETY CHECKS:
 * - Super admin cannot be deleted
 * - Only admins can delete other users
 * - Super admin can delete other admins
 */
export async function deleteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const serviceClient = createServiceRoleClient();

  // Verify the current user is authenticated
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { success: false, error: "Not authenticated" };
  }

  // Check if current user is admin
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { success: false, error: "Not authorized - admin only" };
  }

  // Get target user info from auth
  const { data: targetUser } = await serviceClient.auth.admin.getUserById(userId);

  if (!targetUser?.user) {
    return { success: false, error: "User not found" };
  }

  // SAFETY: Prevent deleting the super admin
  if (targetUser.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: "Cannot delete the super admin account" };
  }

  // Get target profile for role check
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url")
    .eq("id", userId)
    .single();

  const targetWasAdmin = targetProfile?.role === "admin";

  // Only super admin can delete other admins
  if (targetWasAdmin && !isSuperAdmin(currentUser.email)) {
    return { success: false, error: "Only super admin can delete admin accounts" };
  }

  // ============================================
  // STEP 1: Collect and delete storage objects
  // ============================================
  const storageObjects = await collectUserStoragePaths(serviceClient, userId);
  const bucketStats: Record<string, BucketStats> = {};
  const allFailures: StorageFailure[] = [];

  for (const { bucket, paths } of storageObjects) {
    const { stats, failures } = await deleteStorageObjectsResilient(
      serviceClient,
      bucket,
      paths
    );
    bucketStats[bucket] = stats;
    allFailures.push(...failures);
  }

  // ============================================
  // STEP 2: Delete auth user (cascades to profile)
  // ============================================
  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);

  // ============================================
  // STEP 3: Determine status and log
  // ============================================
  let status: "success" | "partial_success" | "failed";
  let notes: string | null = null;

  if (authError) {
    status = "failed";
    notes = `Auth delete failed: ${authError.message}`;
  } else if (allFailures.length > 0) {
    status = "partial_success";
  } else {
    status = "success";
  }

  // Insert audit log
  await insertDeletionLog(serviceClient, {
    actor_user_id: currentUser.id,
    target_user_id: userId,
    actor_is_admin: true,
    actor_is_super_admin: isSuperAdmin(currentUser.email),
    target_was_admin: targetWasAdmin,
    mode: "admin_delete",
    buckets: bucketStats,
    failures: allFailures,
    status,
    notes,
  });

  if (authError) {
    console.error("Auth user delete error:", authError);
    return { success: false, error: `Failed to delete user: ${authError.message}` };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

export async function updateSpotlightType(
  userId: string,
  spotlightType: "performer" | "host" | "studio" | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Verify the current user is an admin
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { success: false, error: "Not authorized - admin only" };
  }

  // Update the spotlight fields
  const updates: {
    is_featured: boolean;
    spotlight_type: string | null;
    featured_at?: string;
  } = {
    is_featured: spotlightType !== null,
    spotlight_type: spotlightType,
  };

  // Set featured_at if turning on spotlight
  if (spotlightType !== null) {
    updates.featured_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    console.error("Update spotlight error:", error);
    return { success: false, error: `Failed to update spotlight: ${error.message}` };
  }

  revalidatePath("/dashboard/admin/users");
  revalidatePath("/spotlight");
  return { success: true };
}

export async function toggleHostStatus(
  userId: string,
  isHost: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Verify the current user is an admin
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { success: false, error: "Not authorized - admin only" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_host: isHost })
    .eq("id", userId);

  if (error) {
    console.error("Toggle host error:", error);
    return { success: false, error: `Failed to toggle host status: ${error.message}` };
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

/**
 * Allows a user to delete their own account.
 * Uses the same complete deletion logic as admin deleteUser.
 *
 * Logs all deletions to user_deletion_log for audit.
 *
 * SAFETY CHECKS:
 * - Super admin cannot self-delete (must be demoted first)
 * - All storage objects are cleaned up
 * - All database records cascade-deleted
 */
export async function deleteOwnAccount(): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const serviceClient = createServiceRoleClient();

  // Get current user
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { success: false, error: "Not authenticated" };
  }

  // SAFETY: Prevent super admin from self-deleting
  if (isSuperAdmin(currentUser.email)) {
    return { success: false, error: "Super admin cannot delete their own account" };
  }

  const userId = currentUser.id;

  // Get current profile to check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const wasAdmin = profile?.role === "admin";

  // ============================================
  // STEP 1: Collect and delete storage objects
  // ============================================
  const storageObjects = await collectUserStoragePaths(serviceClient, userId);
  const bucketStats: Record<string, BucketStats> = {};
  const allFailures: StorageFailure[] = [];

  for (const { bucket, paths } of storageObjects) {
    const { stats, failures } = await deleteStorageObjectsResilient(
      serviceClient,
      bucket,
      paths
    );
    bucketStats[bucket] = stats;
    allFailures.push(...failures);
  }

  // ============================================
  // STEP 2: Delete auth user (cascades to profile)
  // ============================================
  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);

  // ============================================
  // STEP 3: Determine status and log
  // ============================================
  let status: "success" | "partial_success" | "failed";
  let notes: string | null = null;

  if (authError) {
    status = "failed";
    notes = `Auth delete failed: ${authError.message}`;
  } else if (allFailures.length > 0) {
    status = "partial_success";
  } else {
    status = "success";
  }

  // Insert audit log
  await insertDeletionLog(serviceClient, {
    actor_user_id: userId,
    target_user_id: userId,
    actor_is_admin: wasAdmin,
    actor_is_super_admin: false, // Already checked and blocked above
    target_was_admin: wasAdmin,
    mode: "self_delete",
    buckets: bucketStats,
    failures: allFailures,
    status,
    notes,
  });

  if (authError) {
    console.error("Auth user delete error:", authError);
    return { success: false, error: `Failed to delete account: ${authError.message}` };
  }

  return { success: true };
}
