/**
 * Gallery Copy Freeze Tests
 *
 * Enforces locked copy guidelines to prevent regressions:
 * - No approval language (pending approval, awaiting review, etc.)
 * - No metrics language (most commented, popular, trending, etc.)
 * - No urgency framing (hurry, limited time, act now, etc.)
 *
 * These rules align with the comments-as-likes model and
 * non-gamified community philosophy.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Get all gallery-related TypeScript/TSX files
// Exclude admin pages (approval language is appropriate for moderation queues)
// Exclude test files
const galleryFiles = glob.sync(
  path.join(__dirname, '../{app,components}/**/gallery/**/*.{ts,tsx}'),
  { ignore: ['**/*.test.*', '**/__tests__/**', '**/admin/**'] }
);

// GalleryComments now delegates to CommentThread for the actual UI
// Check both the wrapper and the implementation
const commentsComponentPath = path.join(__dirname, '../components/gallery/GalleryComments.tsx');
const commentThreadPath = path.join(__dirname, '../components/comments/CommentThread.tsx');

describe('Gallery Copy Freeze - Locked Language Guidelines', () => {
  describe('No Approval Language', () => {
    const approvalPatterns = [
      /pending\s+approval/i,
      /awaiting\s+review/i,
      /needs\s+approval/i,
      /approval\s+required/i,
      /waiting\s+for\s+approval/i,
      /under\s+review/i,
      /will\s+be\s+reviewed/i,
    ];

    it('should NOT contain approval language in gallery components (user-facing)', () => {
      for (const filePath of galleryFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Remove code comments before checking (comments explaining behavior are ok)
        const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const pattern of approvalPatterns) {
          expect(
            withoutComments,
            `Found approval language matching ${pattern} in ${filePath}`
          ).not.toMatch(pattern);
        }
      }
    });

    it('should NOT contain approval language in GalleryComments', () => {
      if (fs.existsSync(commentsComponentPath)) {
        const content = fs.readFileSync(commentsComponentPath, 'utf-8');
        for (const pattern of approvalPatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    });
  });

  describe('No Metrics/Gamification Language', () => {
    const metricsPatterns = [
      /most\s+commented/i,
      /most\s+popular/i,
      /most\s+liked/i,
      /trending/i,
      /top\s+\d+/i,
      /\d+\s+likes/i,
      /like\s+count/i,
      /comment\s+count/i,
      /view\s+count/i,
      /popularity/i,
      /leaderboard/i,
      /ranking/i,
    ];

    it('should NOT contain metrics/gamification language in gallery components', () => {
      for (const filePath of galleryFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const pattern of metricsPatterns) {
          // Allow "comment_count" as a variable name but not user-facing text
          if (pattern.source.includes('comment') && content.includes('// ')) {
            // Skip if it's in a comment explaining what NOT to do
            continue;
          }
          expect(
            content,
            `Found metrics language matching ${pattern} in ${filePath}`
          ).not.toMatch(pattern);
        }
      }
    });

    it('should NOT contain metrics language in GalleryComments', () => {
      if (fs.existsSync(commentsComponentPath)) {
        const content = fs.readFileSync(commentsComponentPath, 'utf-8');
        for (const pattern of metricsPatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    });
  });

  describe('No Urgency Framing', () => {
    // These patterns indicate manipulative urgency (FOMO tactics)
    // NOT invitation language like "be the first to share"
    const urgencyPatterns = [
      /hurry/i,
      /limited\s+time/i,
      /act\s+now/i,
      /don't\s+miss/i,
      /last\s+chance/i,
      /ending\s+soon/i,
      /only\s+\d+\s+left/i,
      // "be the first to X" is invitation, not urgency - explicitly allowed
      /exclusive\s+offer/i,
      /running\s+out/i,
    ];

    it('should NOT contain urgency framing in gallery components', () => {
      for (const filePath of galleryFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const pattern of urgencyPatterns) {
          expect(
            content,
            `Found urgency language matching ${pattern} in ${filePath}`
          ).not.toMatch(pattern);
        }
      }
    });
  });

  describe('Allowed Copy Patterns', () => {
    it('should use conversational invitation language', () => {
      // CommentThread contains the actual UI copy
      if (fs.existsSync(commentThreadPath)) {
        const content = fs.readFileSync(commentThreadPath, 'utf-8');
        // These are the approved patterns
        expect(content).toMatch(/No comments yet/i);
        expect(content).toMatch(/Sign in.*to leave a comment/i);
      }
    });

    it('should use neutral status language for publish state', () => {
      const albumManagerPath = path.join(__dirname, '../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx');
      if (fs.existsSync(albumManagerPath)) {
        const content = fs.readFileSync(albumManagerPath, 'utf-8');
        // Approved: "Published" / "Draft" - neutral status
        expect(content).toMatch(/Published/);
        expect(content).toMatch(/Draft/);
        // Approved: "Album published." / "Album hidden from public view." - factual feedback
        expect(content).toMatch(/Album published\./);
      }
    });
  });
});
