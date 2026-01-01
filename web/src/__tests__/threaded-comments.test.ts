/**
 * Threaded Comments + Owner Moderation Tests
 *
 * Tests the threading and moderation features:
 * - Reply creates row with correct parent_id
 * - Replies render under parent only (1-level nesting)
 * - Chronological ordering preserved
 * - Owner moderation (hide/unhide)
 * - Admin override
 * - Guardrail: no likes/reactions/counts/trending UI
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Threaded Comments - Reply Functionality", () => {
  const commentThreadPath = path.join(
    __dirname,
    "../components/comments/CommentThread.tsx"
  );

  describe("Threading Schema Support", () => {
    it("CommentThread should query parent_id column", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      expect(content).toMatch(/parent_id/);
    });

    it("should insert with parent_id when replying", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // The insert should set parent_id from the parentId parameter
      expect(content).toMatch(/parent_id:\s*parentId/);
    });

    it("should organize comments into threads", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // Should have a function or logic to organize threads
      expect(content).toMatch(/organizeIntoThreads/);
    });
  });

  describe("Threading UI", () => {
    it("should have Reply button for top-level comments", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // The button contains the text "Reply" - check for the pattern in JSX
      expect(content).toMatch(/>\s*Reply\s*</);
    });

    it("should render replies indented under parent", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // Replies should have visual indentation (ml-6 or similar)
      expect(content).toMatch(/isReply.*ml-|ml-\d.*border-l/);
    });

    it("should limit threading to 1 level (no reply to replies)", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // Reply button should only show for non-replies
      expect(content).toMatch(/!isReply[\s\S]*Reply/);
    });
  });

  describe("Chronological Ordering", () => {
    it("should order comments by created_at", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      expect(content).toMatch(/order.*created_at/i);
    });

    it("should sort replies chronologically within parent", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // organizeIntoThreads should sort replies
      expect(content).toMatch(/replies.*sort.*created_at|sort.*new Date.*created_at/i);
    });
  });
});

describe("Owner Moderation - Hide/Unhide", () => {
  const commentThreadPath = path.join(
    __dirname,
    "../components/comments/CommentThread.tsx"
  );

  describe("Moderation UI", () => {
    it("should have Hide/Unhide button for moderators", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // Check for Hide/Unhide text in JSX ternary expression
      expect(content).toMatch(/"Unhide".*"Hide"|"Hide".*"Unhide"|isHidden.*Unhide.*Hide/);
    });

    it("should check canModerate for hide button visibility", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      expect(content).toMatch(/canModerate\(\)[\s\S]*Hide/);
    });

    it("should toggle is_hidden state", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      expect(content).toMatch(/is_hidden:\s*!currentlyHidden/);
    });

    it("should track hidden_by for audit", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      expect(content).toMatch(/hidden_by/);
    });
  });

  describe("Moderation Permissions", () => {
    it("should allow entity owner to moderate", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // canModerate should check entityOwnerId
      expect(content).toMatch(/entityOwnerId.*currentUserId/);
    });

    it("should allow admin to moderate", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      expect(content).toMatch(/canModerate[\s\S]*isAdmin/);
    });

    it("should show hidden comments to moderators with badge", () => {
      const content = fs.readFileSync(commentThreadPath, "utf-8");
      // Hidden comments should have a visual indicator (amber badge)
      expect(content).toMatch(/isHidden[\s\S]*amber|hidden[\s\S]*amber/i);
    });
  });
});

describe("Author Delete - Soft Delete", () => {
  const commentThreadPath = path.join(
    __dirname,
    "../components/comments/CommentThread.tsx"
  );

  it("should have Delete button for authors", () => {
    const content = fs.readFileSync(commentThreadPath, "utf-8");
    // Check for Delete text in JSX
    expect(content).toMatch(/>\s*Delete\s*</);
  });

  it("should check canDelete for delete button visibility", () => {
    const content = fs.readFileSync(commentThreadPath, "utf-8");
    expect(content).toMatch(/canDelete\(comment\)[\s\S]*Delete/);
  });

  it("should use soft delete (is_deleted = true)", () => {
    const content = fs.readFileSync(commentThreadPath, "utf-8");
    expect(content).toMatch(/is_deleted:\s*true/);
  });

  it("should show deleted indicator for managers", () => {
    const content = fs.readFileSync(commentThreadPath, "utf-8");
    // Deleted comments should have visual indicator
    expect(content).toMatch(/isDeleted.*\[deleted\]|deleted.*badge/i);
  });
});

describe("Profile Comments", () => {
  const profileCommentsPath = path.join(
    __dirname,
    "../components/comments/ProfileComments.tsx"
  );

  it("ProfileComments component should exist", () => {
    expect(fs.existsSync(profileCommentsPath)).toBe(true);
  });

  it("should use CommentThread with profile_comments table", () => {
    const content = fs.readFileSync(profileCommentsPath, "utf-8");
    expect(content).toMatch(/tableName="profile_comments"/);
  });

  it("should pass profileOwnerId for moderation", () => {
    const content = fs.readFileSync(profileCommentsPath, "utf-8");
    expect(content).toMatch(/entityOwnerId=.*profileOwnerId/);
  });

  describe("Profile Page Integration", () => {
    const songwriterPagePath = path.join(
      __dirname,
      "../app/songwriters/[id]/page.tsx"
    );
    const studioPagePath = path.join(
      __dirname,
      "../app/studios/[id]/page.tsx"
    );

    it("songwriter page should include ProfileComments", () => {
      const content = fs.readFileSync(songwriterPagePath, "utf-8");
      expect(content).toMatch(/import.*ProfileComments/);
      expect(content).toMatch(/<ProfileComments/);
    });

    it("studio page should include ProfileComments", () => {
      const content = fs.readFileSync(studioPagePath, "utf-8");
      expect(content).toMatch(/import.*ProfileComments/);
      expect(content).toMatch(/<ProfileComments/);
    });
  });
});

describe("Blog Comments Threading", () => {
  const blogCommentsPath = path.join(
    __dirname,
    "../components/blog/BlogComments.tsx"
  );

  it("should support parent_id for replies", () => {
    const content = fs.readFileSync(blogCommentsPath, "utf-8");
    expect(content).toMatch(/parent_id/);
  });

  it("should organize into threaded structure", () => {
    const content = fs.readFileSync(blogCommentsPath, "utf-8");
    expect(content).toMatch(/organizeIntoThreads/);
  });

  it("should have Reply button", () => {
    const content = fs.readFileSync(blogCommentsPath, "utf-8");
    // Check for Reply text in JSX
    expect(content).toMatch(/>\s*Reply\s*</);
  });
});

describe("Guardrails - No Gamification", () => {
  const commentThreadPath = path.join(
    __dirname,
    "../components/comments/CommentThread.tsx"
  );
  const profileCommentsPath = path.join(
    __dirname,
    "../components/comments/ProfileComments.tsx"
  );
  const blogCommentsPath = path.join(
    __dirname,
    "../components/blog/BlogComments.tsx"
  );

  it("CommentThread should NOT have like/reaction buttons", () => {
    const content = fs.readFileSync(commentThreadPath, "utf-8");
    expect(content).not.toMatch(/like.*button/i);
    expect(content).not.toMatch(/reaction/i);
    expect(content).not.toMatch(/upvote/i);
    expect(content).not.toMatch(/downvote/i);
  });

  it("CommentThread should NOT have trending/popular sorting", () => {
    const content = fs.readFileSync(commentThreadPath, "utf-8");
    expect(content).not.toMatch(/trending/i);
    expect(content).not.toMatch(/most.*liked/i);
    expect(content).not.toMatch(/most.*popular/i);
  });

  it("ProfileComments should NOT have engagement metrics", () => {
    const content = fs.readFileSync(profileCommentsPath, "utf-8");
    expect(content).not.toMatch(/like.*count/i);
    expect(content).not.toMatch(/reaction.*count/i);
  });

  it("BlogComments should NOT have gamification", () => {
    const content = fs.readFileSync(blogCommentsPath, "utf-8");
    expect(content).not.toMatch(/like.*button/i);
    expect(content).not.toMatch(/trending/i);
    expect(content).not.toMatch(/most.*popular/i);
  });
});

describe("Database Migration - Threading Schema", () => {
  const migrationPath = path.join(
    __dirname,
    "../../../supabase/migrations/20260101100000_threaded_comments_and_profile_comments.sql"
  );

  it("migration should exist", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("should add parent_id to blog_comments", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/ALTER TABLE.*blog_comments[\s\S]*ADD.*parent_id/i);
  });

  it("should add parent_id to gallery_album_comments", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/ALTER TABLE.*gallery_album_comments[\s\S]*ADD.*parent_id/i);
  });

  it("should add parent_id to gallery_photo_comments", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/ALTER TABLE.*gallery_photo_comments[\s\S]*ADD.*parent_id/i);
  });

  it("should create profile_comments table", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/CREATE TABLE.*profile_comments/i);
  });

  it("should add is_hidden column for moderation", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/is_hidden boolean/i);
  });

  it("should add hidden_by column for audit", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/hidden_by uuid/i);
  });

  it("should have RLS policies for profile_comments", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toMatch(/CREATE POLICY.*profile_comments/i);
  });
});
