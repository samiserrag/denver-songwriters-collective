"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/auth/adminAuth";

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

  // Update the role
  const newRole = makeAdmin ? "admin" : "performer";
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

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
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

  // Check if target user is an admin (prevent deleting admins)
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .single();

  if (!targetProfile) {
    return { success: false, error: "User not found" };
  }

  if (targetProfile.role === "admin") {
    return { success: false, error: "Cannot delete admin accounts" };
  }

  // Delete related data first (to avoid FK constraint issues)
  // We ignore errors because the tables may not exist or have no related data
  try {
    await supabase.from("event_update_suggestions").delete().eq("submitted_by", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("venue_submissions").delete().eq("submitted_by", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("favorites").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("open_mic_claims").delete().eq("profile_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("blog_posts").delete().eq("author_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("blog_comments").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("blog_likes").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("gallery_images").delete().eq("uploaded_by", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("volunteer_signups").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  try {
    await supabase.from("open_mic_comments").delete().eq("user_id", userId);
  } catch { /* ignore */ }

  // Finally, delete the profile
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    console.error("Profile delete error:", profileError);
    return { success: false, error: `Failed to delete user: ${profileError.message}` };
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
