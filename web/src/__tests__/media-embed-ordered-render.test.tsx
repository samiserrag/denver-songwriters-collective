import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderedMediaEmbeds } from "@/components/media/OrderedMediaEmbeds";

describe("OrderedMediaEmbeds rendering", () => {
  it("renders YouTube and Spotify inline embeds in order", () => {
    const embeds = [
      { id: "1", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", provider: "youtube", kind: "video", position: 0 },
      { id: "2", url: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC", provider: "spotify", kind: "audio", position: 1 },
    ];

    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const iframes = container.querySelectorAll("iframe");
    expect(iframes).toHaveLength(2);
    expect(iframes[0].getAttribute("src")).toContain("youtube-nocookie.com");
    expect(iframes[1].getAttribute("src")).toContain("spotify.com");
  });

  it("renders external URLs as safe outbound cards with rel noopener noreferrer", () => {
    const embeds = [
      { id: "1", url: "https://soundcloud.com/artist/track", provider: "external", kind: "external", position: 0 },
    ];

    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toContain("soundcloud.com");
  });

  it("renders mixed embeds preserving order", () => {
    const embeds = [
      { id: "1", url: "https://soundcloud.com/a", provider: "external", kind: "external", position: 0 },
      { id: "2", url: "https://www.youtube-nocookie.com/embed/abc123xyz", provider: "youtube", kind: "video", position: 1 },
      { id: "3", url: "https://bandcamp.com/album/test", provider: "external", kind: "external", position: 2 },
    ];

    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const children = container.querySelector(".space-y-4")?.children;
    expect(children).toBeDefined();
    expect(children!.length).toBe(3);
    // First is external card (link)
    expect(children![0].tagName.toLowerCase()).toBe("a");
    // Second is youtube embed (div with iframe)
    expect(children![1].querySelector("iframe")).not.toBeNull();
    // Third is external card (link)
    expect(children![2].tagName.toLowerCase()).toBe("a");
  });

  it("returns null for empty embeds", () => {
    const { container } = render(<OrderedMediaEmbeds embeds={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
