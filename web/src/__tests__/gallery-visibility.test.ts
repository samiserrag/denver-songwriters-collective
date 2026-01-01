/**
 * Regression tests: Gallery visibility model
 *
 * These tests ensure the gallery uses the new hide/publish visibility model:
 * - Photos show immediately (is_published=true by default)
 * - Admins hide/unhide instead of approve/reject
 * - Public queries filter on is_published=true AND is_hidden=false
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Gallery Visibility Model', () => {
  describe('Public Gallery Page (/gallery)', () => {
    const galleryPagePath = path.join(__dirname, '../app/gallery/page.tsx');

    it('should filter images by is_published=true', () => {
      const content = fs.readFileSync(galleryPagePath, 'utf-8');
      expect(content).toMatch(/\.eq\(["']is_published["'],\s*true\)/);
    });

    it('should filter images by is_hidden=false', () => {
      const content = fs.readFileSync(galleryPagePath, 'utf-8');
      expect(content).toMatch(/\.eq\(["']is_hidden["'],\s*false\)/);
    });

    it('should NOT use is_approved for filtering', () => {
      const content = fs.readFileSync(galleryPagePath, 'utf-8');
      expect(content).not.toMatch(/\.eq\(["']is_approved["']/);
    });

    it('should have updated copy without approval language', () => {
      const content = fs.readFileSync(galleryPagePath, 'utf-8');
      expect(content).not.toMatch(/after approval/i);
      expect(content).not.toMatch(/pending approval/i);
    });
  });

  describe('Album Detail Page (/gallery/[slug])', () => {
    const albumPagePath = path.join(__dirname, '../app/gallery/[slug]/page.tsx');

    it('should filter albums by is_published=true AND is_hidden=false', () => {
      const content = fs.readFileSync(albumPagePath, 'utf-8');
      expect(content).toMatch(/\.eq\(["']is_published["'],\s*true\)/);
      expect(content).toMatch(/\.eq\(["']is_hidden["'],\s*false\)/);
    });

    it('should filter images by is_published=true AND is_hidden=false', () => {
      const content = fs.readFileSync(albumPagePath, 'utf-8');
      // Should have multiple occurrences for album and images
      const matches = content.match(/\.eq\(["']is_published["'],\s*true\)/g);
      expect(matches?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('User Gallery Upload', () => {
    const uploadPath = path.join(__dirname, '../app/(protected)/dashboard/gallery/UserGalleryUpload.tsx');

    it('should set is_published=true on insert', () => {
      const content = fs.readFileSync(uploadPath, 'utf-8');
      expect(content).toMatch(/is_published:\s*true/);
    });

    it('should set is_hidden=false on insert', () => {
      const content = fs.readFileSync(uploadPath, 'utf-8');
      expect(content).toMatch(/is_hidden:\s*false/);
    });

    it('should NOT set is_approved on insert', () => {
      const content = fs.readFileSync(uploadPath, 'utf-8');
      // Should not be setting is_approved in the insert
      expect(content).not.toMatch(/is_approved:\s*(true|false)/);
    });
  });

  describe('User Gallery Dashboard', () => {
    const dashboardPath = path.join(__dirname, '../app/(protected)/dashboard/gallery/page.tsx');

    it('should query is_hidden and is_published fields', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).toMatch(/is_hidden/);
      expect(content).toMatch(/is_published/);
    });

    it('should NOT query is_approved', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).not.toMatch(/is_approved/);
    });

    it('should have updated copy without approval language', () => {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      expect(content).not.toMatch(/pending review/i);
      expect(content).not.toMatch(/within 24 hours/i);
      expect(content).toMatch(/appear immediately/i);
    });
  });

  describe('Admin Gallery Panel', () => {
    const adminPath = path.join(__dirname, '../app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx');

    it('should have handleHide function', () => {
      const content = fs.readFileSync(adminPath, 'utf-8');
      expect(content).toMatch(/const handleHide/);
    });

    it('should have handleUnhide function', () => {
      const content = fs.readFileSync(adminPath, 'utf-8');
      expect(content).toMatch(/const handleUnhide/);
    });

    it('should NOT have handleApprove function', () => {
      const content = fs.readFileSync(adminPath, 'utf-8');
      expect(content).not.toMatch(/const handleApprove/);
    });

    it('should NOT have handleReject function', () => {
      const content = fs.readFileSync(adminPath, 'utf-8');
      expect(content).not.toMatch(/const handleReject/);
    });

    it('should use visible/hidden filters instead of pending/approved', () => {
      const content = fs.readFileSync(adminPath, 'utf-8');
      expect(content).toMatch(/["']visible["']/);
      expect(content).toMatch(/["']hidden["']/);
      expect(content).not.toMatch(/["']pending["']/);
      expect(content).not.toMatch(/["']approved["']/);
    });
  });
});
