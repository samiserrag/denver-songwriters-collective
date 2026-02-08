import { describe, it, expect, afterEach } from "vitest";
import { getSiteUrl, normalizeSiteUrl } from "./siteUrl";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("normalizeSiteUrl", () => {
  it("adds https when protocol is missing", () => {
    expect(normalizeSiteUrl("coloradosongwriterscollective.org/path")).toBe(
      "https://coloradosongwriterscollective.org"
    );
  });

  it("uses http for localhost", () => {
    expect(normalizeSiteUrl("localhost:3000")).toBe("http://localhost:3000");
  });
});

describe("getSiteUrl", () => {
  it("prefers explicit public env vars", () => {
    process.env.PUBLIC_SITE_URL = "https://public.example.com";
    process.env.NEXT_PUBLIC_SITE_URL = "https://next-public.example.com";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod-project.vercel.app";
    expect(getSiteUrl()).toBe("https://public.example.com");
  });

  it("uses production project URL when explicit site URL env vars are missing", () => {
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "coloradosongwriterscollective.org";
    expect(getSiteUrl()).toBe("https://coloradosongwriterscollective.org");
  });

  it("does not use preview VERCEL_URL fallback and keeps canonical default", () => {
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_URL = "denver-songwriters-collective-preview.vercel.app";
    expect(getSiteUrl()).toBe("https://coloradosongwriterscollective.org");
  });
});
