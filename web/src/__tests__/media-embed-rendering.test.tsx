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

  it("renders Spotify artist profile URLs as native embeds and keeps YouTube profile URLs as cards", () => {
    const { container, getByText } = render(
      <MediaEmbedsSection
        youtubeUrl="https://youtube.com/@marilynwalker"
        spotifyUrl="https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx"
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain("youtube-nocookie.com/embed");
    expect(html).toContain("open.spotify.com/embed/artist/2CIMQHirSU0MQqyYHq0eOx");
    expect(html).toContain("Spotify artist embed");
    expect(getByText("Open on YouTube")).toBeTruthy();
  });

  it("renders YouTube channel profile URLs as native uploads playlist embeds", () => {
    const { container } = render(
      <MediaEmbedsSection
        youtubeUrl="https://www.youtube.com/channel/UC7LteDIZYaYTnTueJyrR-dg"
      />
    );

    const html = container.innerHTML;
    expect(html).toContain("www.youtube-nocookie.com/embed/videoseries?list=UU7LteDIZYaYTnTueJyrR-dg");
    expect(html).toContain("YouTube playlist player");
    expect(html).not.toContain("Open on YouTube");
  });

  it("dedupes Spotify artist profile URLs against existing ordered embeds", () => {
    const { container } = render(
      <MediaEmbedsSection
        spotifyUrl="https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx"
        excludedReferences={["https://open.spotify.com/embed/artist/2CIMQHirSU0MQqyYHq0eOx"]}
      />
    );

    expect(container.innerHTML).toBe("");
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

  it("renders enriched bandcamp profile cards when metadata is available", () => {
    const { container, getByText } = render(
      <MediaEmbedsSection
        bandcampUrl="https://testartist.bandcamp.com"
        bandcampProfileMeta={{
          provider: "bandcamp",
          href: "https://testartist.bandcamp.com/",
          dedupe_key: "https://testartist.bandcamp.com/",
          headline: "Test Artist",
          supportingText: "songs from Colorado",
          ctaLabel: "Listen on Bandcamp",
          thumbnailUrl: "https://f4.bcbits.com/img/a123.jpg",
        }}
      />
    );

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://f4.bcbits.com/img/a123.jpg");
    expect(getByText("Test Artist")).toBeTruthy();
    expect(getByText("songs from Colorado")).toBeTruthy();
    expect(getByText("Listen on Bandcamp")).toBeTruthy();
  });
});
