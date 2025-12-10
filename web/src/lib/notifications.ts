import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

type NotificationType =
  | "new_user"
  | "event_signup"
  | "correction_submitted"
  | "gallery_created"
  | "blog_post_created"
  | "volunteer_signup"
  | "host_claim";

type NotificationParams = {
  type: NotificationType;
  title: string;
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export async function createAdminNotification(
  supabase: SupabaseClient<Database>,
  params: NotificationParams
) {
  const { type, title, message, userId, metadata = {} } = params;

  const { data, error } = await supabase.rpc("create_admin_notification", {
    p_type: type,
    p_title: title,
    p_message: message,
    p_user_id: userId,
    p_metadata: metadata as unknown as undefined,
  });

  if (error) {
    console.error("Failed to create admin notification:", error);
    return null;
  }

  return data;
}

// Convenience functions for common notifications
export const notifications = {
  eventSignup: (
    supabase: SupabaseClient<Database>,
    params: {
      userId: string;
      userName: string;
      eventTitle: string;
      eventId: string;
    }
  ) =>
    createAdminNotification(supabase, {
      type: "event_signup",
      title: "Event Signup",
      message: `${params.userName} signed up for "${params.eventTitle}"`,
      userId: params.userId,
      metadata: { eventId: params.eventId, eventTitle: params.eventTitle },
    }),

  correctionSubmitted: (
    supabase: SupabaseClient<Database>,
    params: {
      userId: string;
      userName: string;
      entityType: string;
      entityName: string;
      suggestionId: string;
    }
  ) =>
    createAdminNotification(supabase, {
      type: "correction_submitted",
      title: "Correction Submitted",
      message: `${params.userName} submitted a correction for ${params.entityType} "${params.entityName}"`,
      userId: params.userId,
      metadata: {
        entityType: params.entityType,
        entityName: params.entityName,
        suggestionId: params.suggestionId,
      },
    }),

  galleryCreated: (
    supabase: SupabaseClient<Database>,
    params: {
      userId: string;
      userName: string;
      albumTitle: string;
      albumId: string;
    }
  ) =>
    createAdminNotification(supabase, {
      type: "gallery_created",
      title: "Gallery Created",
      message: `${params.userName} created a new gallery album: "${params.albumTitle}"`,
      userId: params.userId,
      metadata: { albumId: params.albumId, albumTitle: params.albumTitle },
    }),

  blogPostCreated: (
    supabase: SupabaseClient<Database>,
    params: {
      userId: string;
      userName: string;
      postTitle: string;
      postId: string;
    }
  ) =>
    createAdminNotification(supabase, {
      type: "blog_post_created",
      title: "Blog Post Created",
      message: `${params.userName} created a new blog post: "${params.postTitle}"`,
      userId: params.userId,
      metadata: { postId: params.postId, postTitle: params.postTitle },
    }),

  volunteerSignup: (
    supabase: SupabaseClient<Database>,
    params: {
      name: string;
      email: string;
      roles: string[];
      signupId: string;
    }
  ) =>
    createAdminNotification(supabase, {
      type: "volunteer_signup",
      title: "Volunteer Signup",
      message: `${params.name} signed up to volunteer`,
      metadata: {
        email: params.email,
        roles: params.roles,
        signupId: params.signupId,
      },
    }),

  hostClaim: (
    supabase: SupabaseClient<Database>,
    params: {
      userId: string;
      userName: string;
      openMicName: string;
      openMicId: string;
    }
  ) =>
    createAdminNotification(supabase, {
      type: "host_claim",
      title: "Host Claim Request",
      message: `${params.userName} claimed to be the host of "${params.openMicName}"`,
      userId: params.userId,
      metadata: { openMicId: params.openMicId, openMicName: params.openMicName },
    }),
};
