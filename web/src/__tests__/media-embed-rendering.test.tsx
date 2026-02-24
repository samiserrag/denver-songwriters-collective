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

  it("renders a profile card for non-embeddable music profile URLs", () => {
    const { container, getByText } = render(
      <MediaEmbedsSection
        youtubeUrl="https://youtube.com/@marilynwalker"
        spotifyUrl="https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx"
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain("youtube-nocookie.com/embed");
    expect(html).not.toContain("open.spotify.com/embed");
    expect(getByText("Open on YouTube")).toBeTruthy();
    expect(getByText("Open on Spotify")).toBeTruthy();
  });

  it("renders bandcamp profile links as profile cards", () => {
    const { container, getByText } = render(
      <MediaEmbedsSection
        bandcampUrl="https://testartist.bandcamp.com"
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain("<iframe");
    expect(getByText("Open on Bandcamp")).toBeTruthy();
  });
});
