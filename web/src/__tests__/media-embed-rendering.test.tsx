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

  it("does not render unsupported profile fallback cards", () => {
    const { container } = render(
      <MediaEmbedsSection
        youtubeUrl="https://example.com/not-allowed"
        spotifyUrl={null}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders Spotify artist profile URLs as native embeds and skips unresolved YouTube profile URLs", () => {
    const { container } = render(
      <MediaEmbedsSection
        youtubeUrl="https://youtube.com/@marilynwalker"
        spotifyUrl="https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx"
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain("youtube-nocookie.com/embed");
    expect(html).toContain("open.spotify.com/embed/artist/2CIMQHirSU0MQqyYHq0eOx");
    expect(html).toContain("Spotify artist embed");
    expect(html).not.toContain("Open on YouTube");
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

  it("does not render plain bandcamp profile links as cards", () => {
    const { container } = render(
      <MediaEmbedsSection
        bandcampUrl="https://testartist.bandcamp.com"
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders bandcamp embedded players", () => {
    const { container } = render(
      <MediaEmbedsSection
        bandcampUrl="https://bandcamp.com/EmbeddedPlayer/album=123456/size=large/tracklist=false/artwork=small/transparent=true/"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain("bandcamp.com/EmbeddedPlayer/album=123456");
    expect(iframe?.getAttribute("title")).toBe("Bandcamp player");
  });
});
