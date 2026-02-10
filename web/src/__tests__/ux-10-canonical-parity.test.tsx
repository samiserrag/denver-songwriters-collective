import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("@/components/gallery/GalleryGrid", () => ({
  default: ({ images }: { images: Array<unknown> }) => <div data-testid="gallery-grid">GalleryGrid {images.length}</div>,
}));

vi.mock("@/app/gallery/[slug]/_components/AlbumCommentsSection", () => ({
  AlbumCommentsSection: () => <div data-testid="album-comments">Album comments</div>,
}));

vi.mock("@/components/blog/BlogInteractions", () => ({
  default: () => <div data-testid="blog-interactions">Blog interactions</div>,
}));

vi.mock("@/components/blog/BlogComments", () => ({
  default: () => <div data-testid="blog-comments">Blog comments</div>,
}));

function createBlogListClient({
  posts,
  error,
}: {
  posts: Array<Record<string, unknown>> | null;
  error: Error | null;
}) {
  return {
    from: (table: string) => {
      if (table !== "blog_posts") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => {
          const chain: {
            eq: (column: string, value: unknown) => typeof chain;
            order: () => Promise<{ data: typeof posts; error: Error | null }>;
          } = {
            eq: () => chain,
            order: async () => ({ data: posts, error }),
          };
          return chain;
        },
      };
    },
  };
}

function createGalleryListClient({
  albums,
  albumsError,
  images,
  imagesError,
  imageCount,
}: {
  albums: Array<Record<string, unknown>> | null;
  albumsError: Error | null;
  images: Array<Record<string, unknown>> | null;
  imagesError: Error | null;
  imageCount: number;
}) {
  return {
    from: (table: string) => {
      if (table === "gallery_albums") {
        return {
          select: () => {
            const chain: {
              eq: (column: string, value: unknown) => typeof chain;
              order: () => typeof chain;
              limit: () => Promise<{ data: typeof albums; error: Error | null }>;
            } = {
              eq: () => chain,
              order: () => chain,
              limit: async () => ({ data: albums, error: albumsError }),
            };
            return chain;
          },
        };
      }

      if (table === "gallery_images") {
        return {
          select: () => {
            const chain: {
              eq: (column: string, value: unknown) => typeof chain;
              not: () => typeof chain;
              order: () => typeof chain;
              range: () => Promise<{ data: typeof images; error: Error | null; count: number }>;
            } = {
              eq: () => chain,
              not: () => chain,
              order: () => chain,
              range: async () => ({ data: images, error: imagesError, count: imageCount }),
            };
            return chain;
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function createBlogDetailClient({
  post,
  postError,
}: {
  post: Record<string, unknown> | null;
  postError: Error | null;
}) {
  return {
    from: (table: string) => {
      if (table !== "blog_posts") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => {
          const chain: {
            eq: (column: string, value: unknown) => typeof chain;
            single: () => Promise<{ data: typeof post; error: Error | null }>;
          } = {
            eq: () => chain,
            single: async () => ({ data: post, error: postError }),
          };
          return chain;
        },
      };
    },
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  };
}

function createGalleryDetailClient({
  album,
  albumError,
}: {
  album: Record<string, unknown> | null;
  albumError: Error | null;
}) {
  return {
    from: (table: string) => {
      if (table !== "gallery_albums") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => {
          const chain: {
            eq: (column: string, value: unknown) => typeof chain;
            single: () => Promise<{ data: typeof album; error: Error | null }>;
          } = {
            eq: () => chain,
            single: async () => ({ data: album, error: albumError }),
          };
          return chain;
        },
      };
    },
  };
}

async function loadBlogPageModule(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => client,
  }));
  return import("@/app/blog/page");
}

async function loadGalleryPageModule(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => client,
  }));
  return import("@/app/gallery/page");
}

async function loadBlogDetailModule(client: unknown, notFoundImpl: () => never) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => client,
  }));
  vi.doMock("next/navigation", () => ({
    notFound: notFoundImpl,
    redirect: vi.fn(),
  }));
  return import("@/app/blog/[slug]/page");
}

async function loadGalleryDetailModule(client: unknown, notFoundImpl: () => never) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => client,
  }));
  vi.doMock("next/navigation", () => ({
    notFound: notFoundImpl,
    redirect: vi.fn(),
  }));
  return import("@/app/gallery/[slug]/page");
}

describe("UX-10 canonical parity regression coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("/blog renders posts when qualifying rows exist", async () => {
    const client = createBlogListClient({
      posts: [
        {
          id: "post-1",
          slug: "hello-csc",
          title: "Hello CSC",
          excerpt: "Welcome post",
          cover_image_url: null,
          published_at: "2026-02-10T00:00:00.000Z",
          tags: [],
          author: null,
        },
      ],
      error: null,
    });
    const mod = await loadBlogPageModule(client);
    const element = await mod.default();
    render(element as React.ReactElement);

    expect(screen.getByText("Hello CSC")).toBeInTheDocument();
    expect(screen.queryByText(/No blog posts yet/i)).not.toBeInTheDocument();
  });

  it("/gallery renders content when qualifying rows exist", async () => {
    const client = createGalleryListClient({
      albums: [],
      albumsError: null,
      images: [
        {
          id: "img-1",
          image_url: "https://example.com/photo.jpg",
          caption: "A live set",
        },
      ],
      imagesError: null,
      imageCount: 1,
    });
    const mod = await loadGalleryPageModule(client);
    const element = await mod.default({ searchParams: Promise.resolve({}) });
    render(element as React.ReactElement);

    expect(screen.getByTestId("gallery-grid")).toHaveTextContent("GalleryGrid 1");
    expect(screen.queryByText(/No photos yet/i)).not.toBeInTheDocument();
  });

  it("canonical list pages show error state when Supabase fails", async () => {
    const blogClient = createBlogListClient({
      posts: null,
      error: new Error("db failure"),
    });
    const blogMod = await loadBlogPageModule(blogClient);
    const blogElement = await blogMod.default();
    render(blogElement as React.ReactElement);
    expect(screen.getByText(/trouble loading blog posts/i)).toBeInTheDocument();
    expect(screen.queryByText(/No blog posts yet/i)).not.toBeInTheDocument();

    const galleryClient = createGalleryListClient({
      albums: null,
      albumsError: new Error("db failure"),
      images: null,
      imagesError: new Error("db failure"),
      imageCount: 0,
    });
    const galleryMod = await loadGalleryPageModule(galleryClient);
    const galleryElement = await galleryMod.default({ searchParams: Promise.resolve({}) });
    render(galleryElement as React.ReactElement);
    expect(screen.getByText(/trouble loading gallery photos/i)).toBeInTheDocument();
    expect(screen.queryByText(/No photos yet/i)).not.toBeInTheDocument();
  });

  it("canonical detail pages show error state on query failure", async () => {
    const neverNotFound = () => {
      throw new Error("NEXT_NOT_FOUND");
    };

    const blogClient = createBlogDetailClient({
      post: null,
      postError: new Error("db failure"),
    });
    const blogMod = await loadBlogDetailModule(blogClient, neverNotFound);
    const blogElement = await blogMod.default({ params: Promise.resolve({ slug: "hello-csc" }) });
    render(blogElement as React.ReactElement);
    expect(screen.getByText(/trouble loading this post/i)).toBeInTheDocument();

    const galleryClient = createGalleryDetailClient({
      album: null,
      albumError: new Error("db failure"),
    });
    const galleryMod = await loadGalleryDetailModule(galleryClient, neverNotFound);
    const galleryElement = await galleryMod.default({
      params: Promise.resolve({ slug: "album-1" }),
      searchParams: Promise.resolve({}),
    });
    render(galleryElement as React.ReactElement);
    expect(screen.getByText(/trouble loading this album/i)).toBeInTheDocument();
  });

  it("canonical detail pages only call notFound for true not found", async () => {
    const notFoundError = new Error("NEXT_NOT_FOUND");
    const notFoundImpl = () => {
      throw notFoundError;
    };

    const blogClient = createBlogDetailClient({
      post: null,
      postError: null,
    });
    const blogMod = await loadBlogDetailModule(blogClient, notFoundImpl);
    await expect(
      blogMod.default({ params: Promise.resolve({ slug: "missing-post" }) })
    ).rejects.toBe(notFoundError);

    const galleryClient = createGalleryDetailClient({
      album: null,
      albumError: null,
    });
    const galleryMod = await loadGalleryDetailModule(galleryClient, notFoundImpl);
    await expect(
      galleryMod.default({
        params: Promise.resolve({ slug: "missing-album" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toBe(notFoundError);
  });
});
