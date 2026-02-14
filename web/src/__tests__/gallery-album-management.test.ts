/**
 * Regression tests: Gallery Album Management
 *
 * These tests ensure the album-first gallery management works correctly:
 * - Dashboard shows albums as primary entities
 * - Album management page exists with rename and cover selection
 * - Public gallery uses cover_image_url with fallback to first visible image
 * - Publish toggle controls album visibility
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Gallery Album Management', () => {
  describe('Album Management Page', () => {
    const albumManagerPath = path.join(__dirname, '../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx');
    const albumPagePath = path.join(__dirname, '../app/(protected)/dashboard/gallery/albums/[id]/page.tsx');

    it('should have album management page', () => {
      expect(fs.existsSync(albumPagePath)).toBe(true);
    });

    it('should have AlbumManager component', () => {
      expect(fs.existsSync(albumManagerPath)).toBe(true);
    });

    it('should have handleSetCover function for setting cover image', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/handleSetCover/);
    });

    it('should update cover_image_url when setting cover', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/cover_image_url.*imageUrl/);
    });

    it('should have "Set as cover" button for each image', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/Set as cover/);
    });

    it('should show "Cover" badge on current cover image', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/Cover/);
      expect(content).toMatch(/isCover/);
    });

    it('should have rename functionality with slug update', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/generateSlug/);
      expect(content).toMatch(/handleSaveDetails/);
    });

    it('should have publish toggle', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/handleTogglePublish/);
      expect(content).toMatch(/is_published/);
    });

    it('should show hidden status (read-only for user)', () => {
      const content = fs.readFileSync(albumManagerPath, 'utf-8');
      expect(content).toMatch(/is_hidden/);
      expect(content).toMatch(/Hidden by admin/i);
    });
  });

  describe('User Album Creation UI (CreateAlbumForm)', () => {
    const createFormPath = path.join(__dirname, '../app/(protected)/dashboard/gallery/_components/CreateAlbumForm.tsx');

    it('should have "Create New Album" button', () => {
      const content = fs.readFileSync(createFormPath, 'utf-8');
      expect(content).toMatch(/Create New Album/);
    });

    it('should have "Save as draft" checkbox option', () => {
      const content = fs.readFileSync(createFormPath, 'utf-8');
      expect(content).toMatch(/Save as draft/);
      expect(content).toMatch(/saveAsDraft/);
    });

    it('should default to is_published=true (not draft)', () => {
      const content = fs.readFileSync(createFormPath, 'utf-8');
      // The logic: is_published: !saveAsDraft (default saveAsDraft=false means is_published=true)
      expect(content).toMatch(/is_published:\s*isPublished/);
      expect(content).toMatch(/const isPublished = !saveAsDraft/);
    });

    it('should have venue and event selectors', () => {
      const content = fs.readFileSync(createFormPath, 'utf-8');
      expect(content).toMatch(/venueId/);
      expect(content).toMatch(/eventId/);
      expect(content).toMatch(/CollaboratorSelect/);
    });
  });

  describe('User Dashboard Album-First Layout', () => {
    const dashboardPath = path.join(__dirname, '../app/(protected)/dashboard/gallery/page.tsx');

    it('should fetch user albums', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/gallery_albums/);
      expect(content).toMatch(/created_by.*userId/);
    });

    it('should show album cards with photo counts', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/photoCount/);
      expect(content).toMatch(/My Albums/);
    });

    it('should link to album management page', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/\/dashboard\/gallery\/albums\//);
    });

    it('should show album cover with fallback', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/displayCoverUrl/);
      expect(content).toMatch(/cover_image_url/);
    });

    it('should show publish status on album cards', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/is_published/);
      expect(content).toMatch(/Published|Draft/);
    });

    it('should show hidden status on album cards', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/is_hidden/);
    });
  });

  describe('Public Gallery Cover Behavior', () => {
    const publicGalleryPath = path.join(__dirname, '../app/gallery/page.tsx');

    it('should use cover_image_url for album cards', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      expect(content).toMatch(/cover_image_url/);
    });

    it('should fallback to first visible image if no cover set', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      // Should query for first visible image when no cover_image_url
      expect(content).toMatch(/displayCoverUrl/);
      expect(content).toMatch(/firstImage/);
    });

    it('should use displayCoverUrl for album image rendering', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      expect(content).toMatch(/album\.displayCoverUrl/);
    });

    it('should filter albums by is_published and is_hidden', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      expect(content).toMatch(/\.eq\(["']is_published["'],\s*true\)/);
      expect(content).toMatch(/\.eq\(["']is_hidden["'],\s*false\)/);
    });

    it('should filter images by is_approved and is_hidden', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      // Should have multiple occurrences for different queries
      const approvedMatches = content.match(/\.eq\(["']is_approved["'],\s*true\)/g);
      expect(approvedMatches?.length).toBeGreaterThanOrEqual(2);
    });

    it('should not use is_published for gallery_images filtering', () => {
      const content = fs.readFileSync(publicGalleryPath, 'utf-8');
      expect(content).not.toMatch(/from\("gallery_images"\)[\s\S]*?\.eq\(["']is_published["']/);
    });
  });
});
