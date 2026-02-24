/**
 * Tests: Gallery collaborator notifications, cover fallback, and Save clarity
 *
 * Verifies:
 * 1. Profile pages (studios, performers, songwriters) compute displayCoverUrl
 *    using fallback to first visible image when cover_image_url is null
 * 2. AlbumManager calls server-side notify-collaborators route for newly added collaborators
 * 3. Collaborator helper text is present in AlbumManager
 * 4. Save and Publish actions appear in both top and bottom action rows
 * 5. Email templates exist with correct structure (collaboratorAdded + collaboratorInvited)
 * 6. Server notify-collaborators route has correct auth checks, actor name, invite creation, and email sending
 * 7. Leave-collaboration route exists with correct behavior (marks invite declined)
 * 8. NotificationsList renders Preview/Accept/Decline for gallery_collaborator_invite
 * 9. Templates are registered in template registry and category map
 * 10. Respond-collaboration route exists with accept/decline logic
 * 11. Remove-collaborator route exists for owner/admin removal
 * 12. CollaborationInviteBanner renders on album page for pending invitees
 * 13. AlbumManager and CreateAlbumForm do NOT pass collaboratorIds to reconcile
 * 14. albumLinks.ts buildDesiredAlbumLinks does NOT include collaborator links
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Gallery Album Cover Fallback on Profile Pages", () => {
  const profilePages = [
    {
      name: "studios",
      path: path.join(__dirname, "../app/studios/[id]/page.tsx"),
    },
    {
      name: "performers",
      path: path.join(__dirname, "../app/performers/[id]/page.tsx"),
    },
    {
      name: "songwriters",
      path: path.join(__dirname, "../app/songwriters/[id]/page.tsx"),
    },
  ];

  for (const page of profilePages) {
    describe(`/${page.name}/[id]`, () => {
      const content = fs.readFileSync(page.path, "utf-8");

      it("should resolve displayCoverUrl with fallback to first visible image", () => {
        expect(content).toContain("galleriesWithCovers");
        expect(content).toContain("displayCoverUrl");
      });

      it("should query gallery_images for fallback cover when cover_image_url is null", () => {
        expect(content).toContain("gallery_images");
        expect(content).toContain("is_approved");
        expect(content).toContain("is_hidden");
        expect(content).toContain("sort_order");
      });

      it("should render using displayCoverUrl not raw cover_image_url in album cards", () => {
        expect(content).toMatch(/album\.displayCoverUrl/);
        const renderMatch = content.match(/galleriesWithCovers\.map[\s\S]*?<\/section>/);
        if (renderMatch) {
          expect(renderMatch[0]).not.toContain("album.cover_image_url");
        }
      });

      it("should maintain visibility filters on gallery_albums query", () => {
        expect(content).toContain('is_published", true');
        expect(content).toContain('is_hidden", false');
      });
    });
  }
});

describe("Gallery Collaborator Notifications — AlbumManager client side", () => {
  const albumManagerPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"
  );
  const content = fs.readFileSync(albumManagerPath, "utf-8");

  it("should capture previous collaborator IDs before save", () => {
    expect(content).toContain("prevCollaboratorIds");
  });

  it("should compute newly added collaborator IDs after successful save", () => {
    expect(content).toMatch(/addedIds.*filter.*prevCollaboratorIds/);
  });

  it("should call server notify-collaborators route (not client RPC)", () => {
    expect(content).toContain("/api/gallery-albums/");
    expect(content).toContain("/notify-collaborators");
    expect(content).toContain("added_user_ids");
    expect(content).toContain("album_name");
    expect(content).toContain("album_slug");
    // Must NOT contain the old client-side RPC call
    expect(content).not.toContain('supabase.rpc("create_user_notification"');
  });

  it("should include credentials in fetch for auth cookie forwarding", () => {
    expect(content).toContain('credentials: "include"');
  });

  it("should only notify after successful reconcile (not if save fails)", () => {
    const reconcileIndex = content.indexOf("reconcileAlbumLinks");
    const notifyIndex = content.indexOf("notify-collaborators");
    expect(reconcileIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(reconcileIndex);
  });

  it("should await the notification fetch and toast on error", () => {
    expect(content).toContain("await fetch(");
    expect(content).toContain("collaborator notifications failed");
  });

  it("should NOT pass collaboratorIds to reconcileAlbumLinks", () => {
    // The reconcile call should not include collaboratorIds
    // Find the reconcileAlbumLinks call and ensure no collaboratorIds in it
    const reconcileMatch = content.match(/reconcileAlbumLinks\([\s\S]*?\}\)/);
    expect(reconcileMatch).not.toBeNull();
    expect(reconcileMatch![0]).not.toContain("collaboratorIds");
  });
});

describe("Gallery Collaborator Notifications — Server route", () => {
  const routePath = path.join(
    __dirname,
    "../app/api/gallery-albums/[id]/notify-collaborators/route.ts"
  );
  const content = fs.readFileSync(routePath, "utf-8");

  it("should exist as a POST handler", () => {
    expect(fs.existsSync(routePath)).toBe(true);
    expect(content).toContain("export async function POST");
  });

  it("should authenticate the caller", () => {
    expect(content).toContain("auth.getUser()");
    expect(content).toContain('"Unauthorized"');
    expect(content).toContain("status: 401");
  });

  it("should verify album ownership (created_by or admin)", () => {
    expect(content).toContain("created_by");
    expect(content).toContain("isAdmin");
    expect(content).toContain('"Forbidden"');
    expect(content).toContain("status: 403");
  });

  it("should derive actor name from session user profile", () => {
    expect(content).toContain("actorProfile");
    expect(content).toContain("full_name");
    expect(content).toContain('|| user.email || "Someone"');
  });

  it("should include actor name in notification message", () => {
    expect(content).toContain("actorName");
    expect(content).toMatch(/actorName.*invited you to collaborate/);
  });

  it("should create pending invite via upsert", () => {
    expect(content).toContain("gallery_collaboration_invites");
    expect(content).toContain(".upsert(");
    expect(content).toContain('status: "pending"');
    expect(content).toContain("onConflict");
  });

  it("should use sendEmailWithPreferences for notification + email", () => {
    expect(content).toContain("sendEmailWithPreferences");
    expect(content).toContain("gallery_collaborator_invite");
    expect(content).toContain("Collaboration invite");
    expect(content).toContain('templateKey: "collaboratorInvited"');
  });

  it("should include albumId in notification link", () => {
    expect(content).toContain("albumId=");
    expect(content).toMatch(/albumLink.*albumId/);
  });

  it("should resolve email via resolveInviteeEmail helper (auth-first + profiles fallback)", () => {
    expect(content).toContain("resolveInviteeEmail");
    expect(content).toContain("auth.admin.getUserById");
    // Auth is primary source
    expect(content).toContain('source: "auth"');
    // profiles.email is fallback
    expect(content).toContain('source: "profiles"');
    // null/none is final fallback
    expect(content).toContain('source: "none"');
  });

  it("should use service role client for auth admin lookup", () => {
    expect(content).toContain("getServiceRoleClient");
    expect(content).toContain("serviceClient.auth.admin.getUserById");
  });

  it("should skip email send when no email is resolved (notification only)", () => {
    expect(content).toContain("No email for user");
    expect(content).toContain("skipping email (notification only)");
    expect(content).toContain("create_user_notification");
  });

  it("should log diagnostic info with masked email and source", () => {
    expect(content).toContain("maskedEmail");
    expect(content).toContain("emailSource");
  });

  it("should use server Supabase client (not browser client)", () => {
    expect(content).toContain("createSupabaseServerClient");
  });

  it("should validate request body", () => {
    expect(content).toContain("added_user_ids");
    expect(content).toContain("album_name");
    expect(content).toContain("album_slug");
    expect(content).toContain("status: 400");
  });

  it("should return 404 for missing album", () => {
    expect(content).toContain('"Album not found"');
    expect(content).toContain("status: 404");
  });

  it("should validate UUID format of added_user_ids", () => {
    expect(content).toContain("UUID_RE");
    expect(content).toContain("Invalid user ID format");
  });

  it("should enforce max 10 collaborators per request", () => {
    expect(content).toContain("added_user_ids.length > 10");
    expect(content).toContain("Too many collaborators");
  });
});

describe("Gallery Collaborator Save Clarity", () => {
  const albumManagerPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"
  );
  const content = fs.readFileSync(albumManagerPath, "utf-8");

  it("should have helper text about invites being sent on Save", () => {
    expect(content).toContain("Invites are sent when you click Save");
  });

  it("should label the collaborator field as 'Invite collaborators'", () => {
    expect(content).toContain("Invite collaborators");
  });
});

describe("Save and Publish Actions in Top and Bottom Rows", () => {
  const albumManagerPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"
  );
  const content = fs.readFileSync(albumManagerPath, "utf-8");

  it("should have Save button in the top action row", () => {
    expect(content).toContain("{/* Save button (top) */}");
  });

  it("should have Save button in the bottom action row", () => {
    expect(content).toContain("{/* Save / Cancel / Publish (bottom action row) */}");
  });

  it("should have Publish button in both top and bottom action rows", () => {
    const publishMatches = content.match(/onClick={handleTogglePublish}/g);
    expect(publishMatches).not.toBeNull();
    expect(publishMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should have Cancel button in both top and bottom action rows", () => {
    const cancelMatches = content.match(/onClick={handleCancelEdits}/g);
    expect(cancelMatches).not.toBeNull();
    expect(cancelMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should disable Save when no unsaved changes", () => {
    expect(content).toContain("disabled={isSaving || !hasUnsavedChanges}");
  });
});

describe("Collaborator Email Templates", () => {
  describe("collaboratorAdded template", () => {
    const templatePath = path.join(
      __dirname,
      "../lib/email/templates/collaboratorAdded.ts"
    );

    it("should exist", () => {
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it("should export getCollaboratorAddedEmail function", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("export function getCollaboratorAddedEmail");
    });

    it("should include album name in subject and body", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("albumName");
      expect(content).toContain("collaborator");
    });

    it("should include link to album page", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("albumSlug");
      expect(content).toContain("/gallery/");
    });
  });

  describe("collaboratorInvited template", () => {
    const templatePath = path.join(
      __dirname,
      "../lib/email/templates/collaboratorInvited.ts"
    );

    it("should exist", () => {
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it("should export getCollaboratorInvitedEmail function", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("export function getCollaboratorInvitedEmail");
    });

    it("should include actor name, album name, and invitee name", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("actorName");
      expect(content).toContain("albumName");
      expect(content).toContain("inviteeName");
    });

    it("should include Preview, Accept, and Decline action links", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("Preview");
      expect(content).toContain("Accept");
      expect(content).toContain("Decline");
    });

    it("should include albumId for action links", () => {
      const content = fs.readFileSync(templatePath, "utf-8");
      expect(content).toContain("albumId");
      expect(content).toContain("albumSlug");
    });
  });
});

describe("Leave Collaboration — Server route", () => {
  const routePath = path.join(
    __dirname,
    "../app/api/gallery-albums/[id]/leave-collaboration/route.ts"
  );

  it("should exist as a POST handler", () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("export async function POST");
  });

  it("should require authentication (401)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("auth.getUser()");
    expect(content).toContain('"Unauthorized"');
    expect(content).toContain("status: 401");
  });

  it("should validate album ID format (400)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("UUID_RE");
    expect(content).toContain('"Invalid album ID"');
    expect(content).toContain("status: 400");
  });

  it("should delete only collaborator role links for the caller", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('.eq("album_id", albumId)');
    expect(content).toContain('.eq("target_type", "profile")');
    expect(content).toContain('.eq("target_id", user.id)');
    expect(content).toContain('.eq("link_role", "collaborator")');
  });

  it("should use service role client to bypass RLS", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("getServiceRoleClient");
  });

  it("should mark the invite as declined", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("gallery_collaboration_invites");
    expect(content).toContain('status: "declined"');
    expect(content).toContain("responded_at");
  });

  it("should return { removed: true|false } based on delete result", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("removed");
    expect(content).toMatch(/removed.*data.*length/);
  });
});

describe("Respond Collaboration — Server route", () => {
  const routePath = path.join(
    __dirname,
    "../app/api/gallery-albums/[id]/respond-collaboration/route.ts"
  );

  it("should exist as a POST handler", () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("export async function POST");
  });

  it("should require authentication (401)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("auth.getUser()");
    expect(content).toContain('"Unauthorized"');
    expect(content).toContain("status: 401");
  });

  it("should validate response must be accepted or declined", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('"accepted"');
    expect(content).toContain('"declined"');
  });

  it("should check that invite is pending before responding", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('"pending"');
    // Should return 409 if already responded
    expect(content).toContain("status: 409");
  });

  it("should create gallery_album_links row on accept", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("gallery_album_links");
    expect(content).toContain('"collaborator"');
    expect(content).toContain('"profile"');
  });

  it("should update invite status and responded_at", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("gallery_collaboration_invites");
    expect(content).toContain("responded_at");
  });

  it("should use service role client", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("getServiceRoleClient");
  });
});

describe("Remove Collaborator — Server route", () => {
  const routePath = path.join(
    __dirname,
    "../app/api/gallery-albums/[id]/remove-collaborator/route.ts"
  );

  it("should exist as a POST handler", () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("export async function POST");
  });

  it("should require authentication (401)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("auth.getUser()");
    expect(content).toContain('"Unauthorized"');
    expect(content).toContain("status: 401");
  });

  it("should verify album ownership (created_by or admin)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("created_by");
    expect(content).toContain("isAdmin");
    expect(content).toContain('"Forbidden"');
    expect(content).toContain("status: 403");
  });

  it("should accept invitee_id in request body", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("invitee_id");
    expect(content).toContain("inviteeId");
  });

  it("should delete collaborator link row", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("gallery_album_links");
    expect(content).toContain(".delete()");
    expect(content).toContain('"collaborator"');
  });

  it("should mark invite as declined", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("gallery_collaboration_invites");
    expect(content).toContain('status: "declined"');
  });
});

describe("NotificationsList — Collaboration invite actions", () => {
  const listPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/notifications/NotificationsList.tsx"
  );
  const content = fs.readFileSync(listPath, "utf-8");

  it("should render Preview/Accept/Decline for gallery_collaborator_invite type", () => {
    expect(content).toContain('notification.type === "gallery_collaborator_invite"');
    expect(content).toContain("Preview");
    expect(content).toContain("Accept");
    expect(content).toContain("Decline");
  });

  it("should parse albumId from notification link", () => {
    expect(content).toContain("getAlbumIdFromLink");
    expect(content).toContain('searchParams.get("albumId")');
  });

  it("should call respond-collaboration API route for accept/decline", () => {
    expect(content).toContain("/api/gallery-albums/");
    expect(content).toContain("/respond-collaboration");
    expect(content).toContain('method: "POST"');
  });

  it("should have gallery_collaborator_invite icon", () => {
    expect(content).toContain('"gallery_collaborator_invite"');
  });

  it("should also support Remove myself for gallery_collaborator_added type", () => {
    expect(content).toContain('notification.type === "gallery_collaborator_added"');
    expect(content).toContain("Remove myself");
  });

  it("should call leave-collaboration API route for self-removal", () => {
    expect(content).toContain("/leave-collaboration");
  });
});

describe("CollaborationInviteBanner — Album page component", () => {
  const bannerPath = path.join(
    __dirname,
    "../app/gallery/[slug]/_components/CollaborationInviteBanner.tsx"
  );

  it("should exist as a client component", () => {
    expect(fs.existsSync(bannerPath)).toBe(true);
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should accept albumId, albumName, and inviterName props", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("albumId");
    expect(content).toContain("albumName");
    expect(content).toContain("inviterName");
  });

  it("should render Accept and Decline buttons", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("Accept");
    expect(content).toContain("Decline");
  });

  it("should call respond-collaboration route on button click", () => {
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("/respond-collaboration");
    expect(content).toContain('"accepted"');
    expect(content).toContain('"declined"');
  });
});

describe("Gallery album page — pending invite check", () => {
  const pagePath = path.join(
    __dirname,
    "../app/gallery/[slug]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should check for authenticated user", () => {
    expect(content).toContain("auth.getUser()");
  });

  it("should query gallery_collaboration_invites for pending invite", () => {
    expect(content).toContain("gallery_collaboration_invites");
    expect(content).toContain('"pending"');
  });

  it("should render CollaborationInviteBanner for pending invitees", () => {
    expect(content).toContain("CollaborationInviteBanner");
    expect(content).toContain("pendingInvite");
  });

  it("should use service role client for invite query", () => {
    expect(content).toContain("getServiceRoleClient");
  });
});

describe("albumLinks.ts — Collaborator exclusion from reconcile", () => {
  const linksPath = path.join(
    __dirname,
    "../lib/gallery/albumLinks.ts"
  );
  const content = fs.readFileSync(linksPath, "utf-8");

  it("should NOT include collaboratorIds in AlbumLinkInput", () => {
    expect(content).not.toContain("collaboratorIds");
  });

  it("should NOT build collaborator links in buildDesiredAlbumLinks", () => {
    // The function should not reference collaborator in its logic
    const fnMatch = content.match(/function buildDesiredAlbumLinks[\s\S]*?^}/m);
    if (fnMatch) {
      expect(fnMatch[0]).not.toContain("collaborator");
    }
  });

  it("should document that collaborators are managed via invite flow", () => {
    expect(content).toContain("opt-in invitation flow");
  });
});

describe("CreateAlbumForm — Collaborator invite on create", () => {
  const formPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/_components/CreateAlbumForm.tsx"
  );
  const content = fs.readFileSync(formPath, "utf-8");

  it("should NOT pass collaboratorIds to reconcileAlbumLinks", () => {
    const reconcileMatch = content.match(/reconcileAlbumLinks\([\s\S]*?\}\)/);
    expect(reconcileMatch).not.toBeNull();
    expect(reconcileMatch![0]).not.toContain("collaboratorIds");
  });

  it("should send collaboration invites via notify-collaborators route", () => {
    expect(content).toContain("/notify-collaborators");
    expect(content).toContain("added_user_ids");
    expect(content).toContain("album_name");
    expect(content).toContain("album_slug");
  });

  it("should label collaborator field as 'Invite collaborators'", () => {
    expect(content).toContain("Invite collaborators");
  });

  it("should note that collaborators must accept", () => {
    expect(content).toContain("they must accept");
  });
});

describe("sendEmailWithPreferences — defensive guard against empty recipient", () => {
  const sendPath = path.join(
    __dirname,
    "../lib/email/sendWithPreferences.ts"
  );
  const content = fs.readFileSync(sendPath, "utf-8");

  it("should validate recipient is non-empty before attempting send", () => {
    expect(content).toContain("payload.to");
    expect(content).toContain(".trim()");
  });

  it("should return missing_recipient skipReason for empty to", () => {
    expect(content).toContain('"missing_recipient"');
    expect(content).toContain("missing recipient");
  });

  it("should still create notification even when recipient is missing", () => {
    // The guard block should still call create_user_notification
    expect(content).toContain("create_user_notification");
  });

  it("should never call sendEmail with empty recipient", () => {
    // The guard returns before reaching sendEmail
    const guardBlock = content.match(/Step 0:.*?Step 1:/s);
    expect(guardBlock).not.toBeNull();
    expect(guardBlock![0]).toContain("return result");
  });
});

describe("Collaborator Email — Registry and Category Registration", () => {
  it("collaboratorAdded should be registered in TEMPLATE_REGISTRY", () => {
    const registryPath = path.join(
      __dirname,
      "../lib/email/registry.ts"
    );
    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain('"collaboratorAdded"');
    expect(content).toContain("collaboratorAdded:");
    expect(content).toContain('| "collaboratorAdded"');
    expect(content).toContain('case "collaboratorAdded"');
    expect(content).toContain("getCollaboratorAddedEmail");
    expect(content).toContain("CollaboratorAddedEmailParams");
  });

  it("collaboratorInvited should be registered in TEMPLATE_REGISTRY", () => {
    const registryPath = path.join(
      __dirname,
      "../lib/email/registry.ts"
    );
    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain('"collaboratorInvited"');
    expect(content).toContain("collaboratorInvited:");
    expect(content).toContain('| "collaboratorInvited"');
    expect(content).toContain('case "collaboratorInvited"');
    expect(content).toContain("getCollaboratorInvitedEmail");
    expect(content).toContain("CollaboratorInvitedEmailParams");
  });

  it("both templates should be mapped to invitations category", () => {
    const prefsPath = path.join(
      __dirname,
      "../lib/notifications/preferences.ts"
    );
    const content = fs.readFileSync(prefsPath, "utf-8");
    expect(content).toContain('collaboratorAdded: "invitations"');
    expect(content).toContain('collaboratorInvited: "invitations"');
  });
});
