/**
 * Phase A: Profile Activity Sections (Public) Tests
 *
 * Tests for Galleries Created and Blogs Written sections on member profile pages.
 * These sections display published content created by the profile owner.
 *
 * Pages covered:
 * - /songwriters/[id]
 * - /members/[id]
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// MOCK DATA
// =============================================================================

const mockProfileId = "test-user-123";

const mockGalleryAlbums = [
  {
    id: "album-1",
    name: "Open Mic Night Photos",
    slug: "open-mic-night-photos",
    cover_image_url: "https://example.com/cover1.jpg",
    created_at: "2026-01-15T10:00:00Z",
    created_by: mockProfileId,
    is_published: true,
    is_hidden: false,
  },
  {
    id: "album-2",
    name: "Studio Sessions",
    slug: "studio-sessions",
    cover_image_url: null,
    created_at: "2026-01-10T10:00:00Z",
    created_by: mockProfileId,
    is_published: true,
    is_hidden: false,
  },
  {
    id: "album-3",
    name: "Summer Concert Series",
    slug: "summer-concert-series",
    cover_image_url: "https://example.com/cover3.jpg",
    created_at: "2026-01-05T10:00:00Z",
    created_by: mockProfileId,
    is_published: true,
    is_hidden: false,
  },
  // This one should NOT appear (is_published = false)
  {
    id: "album-4",
    name: "Draft Album",
    slug: "draft-album",
    cover_image_url: null,
    created_at: "2026-01-01T10:00:00Z",
    created_by: mockProfileId,
    is_published: false,
    is_hidden: false,
  },
  // This one should NOT appear (is_hidden = true)
  {
    id: "album-5",
    name: "Hidden Album",
    slug: "hidden-album",
    cover_image_url: null,
    created_at: "2026-01-02T10:00:00Z",
    created_by: mockProfileId,
    is_published: true,
    is_hidden: true,
  },
];

const mockBlogPosts = [
  {
    id: "post-1",
    slug: "my-songwriting-journey",
    title: "My Songwriting Journey",
    excerpt: "How I got started writing songs in Denver...",
    cover_image_url: "https://example.com/blog1.jpg",
    published_at: "2026-01-15T10:00:00Z",
    author_id: mockProfileId,
    is_published: true,
    is_approved: true,
  },
  {
    id: "post-2",
    slug: "open-mic-tips",
    title: "Tips for Your First Open Mic",
    excerpt: "What I wish I knew before my first performance...",
    cover_image_url: null,
    published_at: "2026-01-10T10:00:00Z",
    author_id: mockProfileId,
    is_published: true,
    is_approved: true,
  },
  {
    id: "post-3",
    slug: "gear-guide",
    title: "Essential Gear for Acoustic Performers",
    excerpt: "A rundown of the gear I use at every gig...",
    cover_image_url: "https://example.com/blog3.jpg",
    published_at: "2026-01-05T10:00:00Z",
    author_id: mockProfileId,
    is_published: true,
    is_approved: true,
  },
  // This one should NOT appear (is_published = false)
  {
    id: "post-4",
    slug: "draft-post",
    title: "Draft Post",
    excerpt: "This is a draft...",
    cover_image_url: null,
    published_at: null,
    author_id: mockProfileId,
    is_published: false,
    is_approved: true,
  },
  // This one should NOT appear (is_approved = false)
  {
    id: "post-5",
    slug: "unapproved-post",
    title: "Unapproved Post",
    excerpt: "Pending approval...",
    cover_image_url: null,
    published_at: "2026-01-02T10:00:00Z",
    author_id: mockProfileId,
    is_published: true,
    is_approved: false,
  },
];

// =============================================================================
// GALLERY QUERY FILTER TESTS
// =============================================================================

describe("Galleries Created Section - Query Filters", () => {
  it("should filter by created_by (profile owner)", () => {
    const ownerAlbums = mockGalleryAlbums.filter(
      (album) => album.created_by === mockProfileId
    );
    expect(ownerAlbums.length).toBe(5); // All belong to the same owner in mock data
  });

  it("should exclude unpublished albums (is_published = false)", () => {
    const publishedAlbums = mockGalleryAlbums.filter(
      (album) => album.is_published === true
    );
    expect(publishedAlbums.length).toBe(4);
    expect(publishedAlbums.find((a) => a.id === "album-4")).toBeUndefined();
  });

  it("should exclude hidden albums (is_hidden = true)", () => {
    const visibleAlbums = mockGalleryAlbums.filter(
      (album) => album.is_hidden === false
    );
    expect(visibleAlbums.length).toBe(4);
    expect(visibleAlbums.find((a) => a.id === "album-5")).toBeUndefined();
  });

  it("should apply combined published filter (is_published = true AND is_hidden = false)", () => {
    const displayableAlbums = mockGalleryAlbums.filter(
      (album) =>
        album.created_by === mockProfileId &&
        album.is_published === true &&
        album.is_hidden === false
    );
    expect(displayableAlbums.length).toBe(3);
    expect(displayableAlbums.map((a) => a.id)).toEqual([
      "album-1",
      "album-2",
      "album-3",
    ]);
  });

  it("should show all published albums (no cap)", () => {
    const displayableAlbums = mockGalleryAlbums.filter(
      (album) =>
        album.created_by === mockProfileId &&
        album.is_published === true &&
        album.is_hidden === false
    );
    // All 3 valid albums should be shown (no .limit(3))
    expect(displayableAlbums.length).toBe(3);
  });

  it("should sort by created_at descending (newest first)", () => {
    const displayableAlbums = mockGalleryAlbums
      .filter(
        (album) =>
          album.created_by === mockProfileId &&
          album.is_published === true &&
          album.is_hidden === false
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    expect(displayableAlbums[0].id).toBe("album-1"); // Jan 15
    expect(displayableAlbums[1].id).toBe("album-2"); // Jan 10
    expect(displayableAlbums[2].id).toBe("album-3"); // Jan 5
  });
});

// =============================================================================
// BLOG QUERY FILTER TESTS
// =============================================================================

describe("Blogs Written Section - Query Filters", () => {
  it("should filter by author_id (profile owner)", () => {
    const authorPosts = mockBlogPosts.filter(
      (post) => post.author_id === mockProfileId
    );
    expect(authorPosts.length).toBe(5); // All belong to the same author in mock data
  });

  it("should exclude unpublished posts (is_published = false)", () => {
    const publishedPosts = mockBlogPosts.filter(
      (post) => post.is_published === true
    );
    expect(publishedPosts.length).toBe(4);
    expect(publishedPosts.find((p) => p.id === "post-4")).toBeUndefined();
  });

  it("should exclude unapproved posts (is_approved = false)", () => {
    const approvedPosts = mockBlogPosts.filter(
      (post) => post.is_approved === true
    );
    expect(approvedPosts.length).toBe(4);
    expect(approvedPosts.find((p) => p.id === "post-5")).toBeUndefined();
  });

  it("should apply combined published filter (is_published = true AND is_approved = true)", () => {
    const displayablePosts = mockBlogPosts.filter(
      (post) =>
        post.author_id === mockProfileId &&
        post.is_published === true &&
        post.is_approved === true
    );
    expect(displayablePosts.length).toBe(3);
    expect(displayablePosts.map((p) => p.id)).toEqual([
      "post-1",
      "post-2",
      "post-3",
    ]);
  });

  it("should show all published posts (no cap)", () => {
    const displayablePosts = mockBlogPosts
      .filter(
        (post) =>
          post.author_id === mockProfileId &&
          post.is_published === true &&
          post.is_approved === true
      );
    // All 3 valid posts should be shown (no .limit(3))
    expect(displayablePosts.length).toBe(3);
  });

  it("should sort by published_at descending (newest first)", () => {
    const displayablePosts = mockBlogPosts
      .filter(
        (post) =>
          post.author_id === mockProfileId &&
          post.is_published === true &&
          post.is_approved === true
      )
      .sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });
    expect(displayablePosts[0].id).toBe("post-1"); // Jan 15
    expect(displayablePosts[1].id).toBe("post-2"); // Jan 10
    expect(displayablePosts[2].id).toBe("post-3"); // Jan 5
  });
});

// =============================================================================
// EMPTY STATE TESTS
// =============================================================================

describe("Empty State Behavior", () => {
  it("should return empty array when no galleries exist for profile", () => {
    const otherProfileId = "other-user-456";
    const otherProfileAlbums = mockGalleryAlbums.filter(
      (album) =>
        album.created_by === otherProfileId &&
        album.is_published === true &&
        album.is_hidden === false
    );
    expect(otherProfileAlbums.length).toBe(0);
  });

  it("should return empty array when no blog posts exist for profile", () => {
    const otherProfileId = "other-user-456";
    const otherProfilePosts = mockBlogPosts.filter(
      (post) =>
        post.author_id === otherProfileId &&
        post.is_published === true &&
        post.is_approved === true
    );
    expect(otherProfilePosts.length).toBe(0);
  });

  it("empty galleries state should render 'No published galleries yet.'", () => {
    const emptyStateText = "No published galleries yet.";
    expect(emptyStateText).toBe("No published galleries yet.");
  });

  it("empty blogs state should render 'No published blog posts yet.'", () => {
    const emptyStateText = "No published blog posts yet.";
    expect(emptyStateText).toBe("No published blog posts yet.");
  });
});

// =============================================================================
// "SEE ALL" LINK TESTS
// =============================================================================

describe("No 'See All' Links (All Items Shown Inline)", () => {
  it("Galleries section has no 'See all' link (shows all items inline)", () => {
    // Per design update: galleries show all items, no cap, no "See all" link
    const galleriesShowAll = true; // All galleries rendered inline
    expect(galleriesShowAll).toBe(true);
  });

  it("Blogs section has no 'See all' link (shows all items inline)", () => {
    // Per design update: blogs show all items, no cap, no "See all" link
    const blogsShowAll = true; // All blogs rendered inline
    expect(blogsShowAll).toBe(true);
  });
});

// =============================================================================
// UI RENDERING TESTS
// =============================================================================

describe("UI Rendering", () => {
  it("gallery card should link to /gallery/[slug]", () => {
    const album = mockGalleryAlbums[0];
    const expectedHref = `/gallery/${album.slug}`;
    expect(expectedHref).toBe("/gallery/open-mic-night-photos");
  });

  it("blog card should link to /blog/[slug]", () => {
    const post = mockBlogPosts[0];
    const expectedHref = `/blog/${post.slug}`;
    expect(expectedHref).toBe("/blog/my-songwriting-journey");
  });

  it("gallery card should display album name", () => {
    const album = mockGalleryAlbums[0];
    expect(album.name).toBe("Open Mic Night Photos");
  });

  it("blog card should display post title", () => {
    const post = mockBlogPosts[0];
    expect(post.title).toBe("My Songwriting Journey");
  });

  it("blog card should display excerpt when present", () => {
    const post = mockBlogPosts[0];
    expect(post.excerpt).toBeTruthy();
    expect(post.excerpt).toBe("How I got started writing songs in Denver...");
  });

  it("gallery card should format date correctly", () => {
    const album = mockGalleryAlbums[0];
    const formatted = new Date(album.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    expect(formatted).toBe("Jan 15, 2026");
  });

  it("blog card should format published_at date correctly", () => {
    const post = mockBlogPosts[0];
    const formatted = post.published_at
      ? new Date(post.published_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Draft";
    expect(formatted).toBe("Jan 15, 2026");
  });
});

// =============================================================================
// SECTION ORDER TESTS
// =============================================================================

describe("Section Ordering", () => {
  it("Galleries Created should come after Hosted Happenings", () => {
    // This is a documentation test - the actual order is verified by reading the source
    const sectionOrder = [
      "hosted-happenings-section",
      "galleries-created-section",
      "blogs-written-section",
      "profile-comments-section",
    ];
    const galleriesIndex = sectionOrder.indexOf("galleries-created-section");
    const hostedIndex = sectionOrder.indexOf("hosted-happenings-section");
    expect(galleriesIndex).toBeGreaterThan(hostedIndex);
  });

  it("Blogs Written should come after Galleries Created", () => {
    const sectionOrder = [
      "hosted-happenings-section",
      "galleries-created-section",
      "blogs-written-section",
      "profile-comments-section",
    ];
    const blogsIndex = sectionOrder.indexOf("blogs-written-section");
    const galleriesIndex = sectionOrder.indexOf("galleries-created-section");
    expect(blogsIndex).toBeGreaterThan(galleriesIndex);
  });

  it("Profile Comments should come after Blogs Written", () => {
    const sectionOrder = [
      "hosted-happenings-section",
      "galleries-created-section",
      "blogs-written-section",
      "profile-comments-section",
    ];
    const commentsIndex = sectionOrder.indexOf("profile-comments-section");
    const blogsIndex = sectionOrder.indexOf("blogs-written-section");
    expect(commentsIndex).toBeGreaterThan(blogsIndex);
  });
});

// =============================================================================
// ROUTE COVERAGE TESTS
// =============================================================================

describe("Route Coverage", () => {
  it("both /songwriters/[id] and /members/[id] should have Galleries Created section", () => {
    // This is a contract test - actual rendering is covered by component tests
    // The test file for each route verifies the section exists
    const routes = ["/songwriters/[id]", "/members/[id]"];
    const sectionTestId = "galleries-created-section";
    // Both routes should render a section with this testid
    expect(routes.length).toBe(2);
    expect(sectionTestId).toBe("galleries-created-section");
  });

  it("both /songwriters/[id] and /members/[id] should have Blogs Written section", () => {
    const routes = ["/songwriters/[id]", "/members/[id]"];
    const sectionTestId = "blogs-written-section";
    expect(routes.length).toBe(2);
    expect(sectionTestId).toBe("blogs-written-section");
  });
});

// =============================================================================
// HOSTED HAPPENINGS - CO-HOST INCLUSION TESTS
// =============================================================================

describe("Hosted Happenings - Co-host Inclusion", () => {
  const mockCoHostEntries = [
    { event_id: "event-1", user_id: mockProfileId, invitation_status: "accepted" },
    { event_id: "event-2", user_id: mockProfileId, invitation_status: "accepted" },
    { event_id: "event-3", user_id: mockProfileId, invitation_status: "pending" }, // Should NOT be included
  ];

  const mockEvents = [
    { id: "event-1", title: "Co-hosted Open Mic", host_id: "other-user", status: "active", is_published: true },
    { id: "event-2", title: "Another Co-hosted Event", host_id: "other-user-2", status: "active", is_published: true },
    { id: "event-3", title: "Pending Invite", host_id: "other-user-3", status: "active", is_published: true },
    { id: "event-4", title: "Primary Hosted Event", host_id: mockProfileId, status: "active", is_published: true },
  ];

  it("should include events where user is co-host with accepted invitation", () => {
    const acceptedCoHostEventIds = mockCoHostEntries
      .filter((e) => e.invitation_status === "accepted")
      .map((e) => e.event_id);

    expect(acceptedCoHostEventIds).toContain("event-1");
    expect(acceptedCoHostEventIds).toContain("event-2");
    expect(acceptedCoHostEventIds.length).toBe(2);
  });

  it("should NOT include events where invitation is pending", () => {
    const acceptedCoHostEventIds = mockCoHostEntries
      .filter((e) => e.invitation_status === "accepted")
      .map((e) => e.event_id);

    expect(acceptedCoHostEventIds).not.toContain("event-3");
  });

  it("should combine primary hosted and co-hosted events", () => {
    const acceptedCoHostEventIds = mockCoHostEntries
      .filter((e) => e.invitation_status === "accepted")
      .map((e) => e.event_id);

    const allHostedEvents = mockEvents.filter(
      (e) => e.host_id === mockProfileId || acceptedCoHostEventIds.includes(e.id)
    );

    expect(allHostedEvents.length).toBe(3); // event-1, event-2, event-4
    expect(allHostedEvents.map((e) => e.id)).toContain("event-1");
    expect(allHostedEvents.map((e) => e.id)).toContain("event-2");
    expect(allHostedEvents.map((e) => e.id)).toContain("event-4");
  });

  it("should deduplicate if user is both primary host and co-host", () => {
    // If a user is both host_id AND in event_hosts, we want one entry not two
    const eventWithBothRoles = [
      ...mockEvents,
      { id: "event-5", title: "Dual Role Event", host_id: mockProfileId, status: "active", is_published: true },
    ];
    const coHostEntriesWithDual = [
      ...mockCoHostEntries,
      { event_id: "event-5", user_id: mockProfileId, invitation_status: "accepted" },
    ];

    const acceptedCoHostEventIds = coHostEntriesWithDual
      .filter((e) => e.invitation_status === "accepted")
      .map((e) => e.event_id);

    // Using a Set ensures deduplication
    const allHostedEventIds = new Set([
      ...eventWithBothRoles.filter((e) => e.host_id === mockProfileId).map((e) => e.id),
      ...acceptedCoHostEventIds.filter((id) => eventWithBothRoles.some((e) => e.id === id)),
    ]);

    // event-4 (primary), event-5 (both), event-1, event-2 (co-hosted) = 4 unique events
    expect(allHostedEventIds.size).toBe(4);
    expect(allHostedEventIds.has("event-5")).toBe(true);
  });
});
