/**
 * Gallery Photo Comments Tests
 *
 * Tests the comments-as-likes model for gallery images:
 * - Comments system exists without like/reaction UI
 * - No counts, rankings, or gamification
 * - Proper moderation (soft delete by author/owner/admin)
 * - Comments are conversational, not a scoreboard
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Gallery Photo Comments - Comments-as-Likes Model', () => {
  describe('Schema Requirements', () => {
    // Migration is in root /supabase, not web/supabase
    const migrationPath = path.join(__dirname, '../../../supabase/migrations/20251221044056_gallery_comments.sql');

    it('should have gallery_photo_comments table', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toMatch(/CREATE TABLE public\.gallery_photo_comments/);
    });

    it('should have is_deleted column for soft delete', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toMatch(/is_deleted boolean NOT NULL DEFAULT false/);
    });

    it('should NOT have counter or total columns', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).not.toMatch(/comment_count/i);
      expect(content).not.toMatch(/total_comments/i);
      expect(content).not.toMatch(/like_count/i);
    });

    it('should have RLS policies for moderation', () => {
      const content = fs.readFileSync(migrationPath, 'utf-8');
      // Should have soft delete policy for author, admin, uploader, album owner
      expect(content).toMatch(/gallery_photo_comments_update_soft_delete/);
      expect(content).toMatch(/is_admin\(\)/);
      expect(content).toMatch(/uploaded_by = auth\.uid\(\)/);
    });
  });

  describe('GalleryComments Component', () => {
    const componentPath = path.join(__dirname, '../components/gallery/GalleryComments.tsx');

    it('should exist and handle photo comments', () => {
      expect(fs.existsSync(componentPath)).toBe(true);
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toMatch(/type: "photo" \| "album"/);
    });

    it('should NOT render like/heart/reaction buttons', () => {
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).not.toMatch(/like.*button/i);
      expect(content).not.toMatch(/heart.*button/i);
      expect(content).not.toMatch(/reaction/i);
      expect(content).not.toMatch(/<button.*like/i);
    });

    it('should NOT display comment counts prominently (only subtle count in header)', () => {
      const content = fs.readFileSync(componentPath, 'utf-8');
      // The only count should be the subtle "(N)" in the header, not "most commented" or rankings
      expect(content).not.toMatch(/most commented/i);
      expect(content).not.toMatch(/top comment/i);
      expect(content).not.toMatch(/popular/i);
    });

    it('should show delete button for authorized users', () => {
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toMatch(/canDelete/);
      expect(content).toMatch(/handleDelete/);
      expect(content).toMatch(/Delete comment/);
    });

    it('should use soft delete (is_deleted)', () => {
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toMatch(/update.*is_deleted.*true/i);
    });

    it('should order comments by created_at (chronological, not by popularity)', () => {
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toMatch(/order.*created_at.*ascending.*true/i);
      // Should NOT order by count or popularity
      expect(content).not.toMatch(/order.*count/i);
      expect(content).not.toMatch(/order.*popularity/i);
      expect(content).not.toMatch(/order.*likes/i);
    });

    it('should show sign-in prompt for non-authenticated users', () => {
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toMatch(/Sign in.*to leave a comment/);
    });
  });

  describe('GalleryGrid Lightbox Integration', () => {
    const gridPath = path.join(__dirname, '../components/gallery/GalleryGrid.tsx');

    it('should include GalleryComments in lightbox', () => {
      const content = fs.readFileSync(gridPath, 'utf-8');
      expect(content).toMatch(/<GalleryComments/);
      expect(content).toMatch(/type="photo"/);
    });

    it('should pass imageUploaderId for moderation', () => {
      const content = fs.readFileSync(gridPath, 'utf-8');
      expect(content).toMatch(/imageUploaderId=/);
    });

    it('should pass albumOwnerId for moderation', () => {
      const content = fs.readFileSync(gridPath, 'utf-8');
      expect(content).toMatch(/albumOwnerId=/);
    });

    it('should NOT have like/heart/reaction buttons in lightbox', () => {
      const content = fs.readFileSync(gridPath, 'utf-8');
      expect(content).not.toMatch(/like.*button/i);
      expect(content).not.toMatch(/heart/i);
      expect(content).not.toMatch(/reaction/i);
    });
  });

  describe('Album Comments Section', () => {
    const albumPath = path.join(__dirname, '../app/gallery/[slug]/_components/AlbumCommentsSection.tsx');

    it('should exist for album-level comments', () => {
      expect(fs.existsSync(albumPath)).toBe(true);
    });

    it('should use GalleryComments with type="album"', () => {
      const content = fs.readFileSync(albumPath, 'utf-8');
      expect(content).toMatch(/type="album"/);
    });

    it('should NOT show comment counts or rankings', () => {
      const content = fs.readFileSync(albumPath, 'utf-8');
      expect(content).not.toMatch(/most commented/i);
      expect(content).not.toMatch(/comment count/i);
    });
  });

  describe('Public Gallery - No Gamification', () => {
    const publicGalleryPath = path.join(__dirname, '../app/gallery/page.tsx');

    it('should NOT sort or filter by comment totals', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      // Should not order by comment_count or similar
      expect(content).not.toMatch(/comment_count/i);
      expect(content).not.toMatch(/order.*comment/i);
      expect(content).not.toMatch(/most.*comment/i);
    });

    it('should NOT show like/reaction counts on thumbnails', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      expect(content).not.toMatch(/like.*count/i);
      expect(content).not.toMatch(/reaction.*count/i);
      expect(content).not.toMatch(/heart.*count/i);
    });
  });

  describe('Album Page - No Gamification', () => {
    const albumPagePath = path.join(__dirname, '../app/gallery/[slug]/page.tsx');

    it('should NOT sort images by comment totals', () => {
      const content = fs.readFileSync(albumPagePath, 'utf-8');
      expect(content).not.toMatch(/order.*comment_count/i);
      expect(content).not.toMatch(/most.*commented/i);
    });

    it('should NOT show badges for "most commented" images', () => {
      const content = fs.readFileSync(albumPagePath, 'utf-8');
      expect(content).not.toMatch(/badge.*comment/i);
      expect(content).not.toMatch(/most commented/i);
      expect(content).not.toMatch(/popular/i);
    });
  });
});
