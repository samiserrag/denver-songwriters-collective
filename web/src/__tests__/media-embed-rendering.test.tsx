import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaEmbedsSection } from "@/components/media/MediaEmbedsSection";

describe("media embed rendering", () => {
  it("renders youtube-nocookie and spotify iframe hosts for valid URLs", () => {
    const { container } = render(
      <MediaEmbedsSection
        youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        spotifyUrl="https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd"
      />
    );

    const html = container.innerHTML;
    expect(html).toContain("www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("open.spotify.com/embed/playlist/37i9dQZF1DX0XUsuxWHRQd");
  });

  it("renders a safe fallback link when URL is unsupported", () => {
    const { container } = render(
      <MediaEmbedsSection
        youtubeUrl="https://example.com/not-allowed"
        spotifyUrl={null}
      />
    );

    const html = container.innerHTML;
    expect(html).toContain("Open YouTube");
    expect(html).not.toContain("<script");
  });
});
