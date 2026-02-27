import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const templatesDir = path.join(process.cwd(), "..", "supabase", "templates");
const HEADER_URL = "https://coloradosongwriterscollective.org/images/CSCEmailHeader1.png";

describe("Supabase auth email templates", () => {
  it("all HTML templates use the stable absolute header image URL", () => {
    const htmlTemplates = fs
      .readdirSync(templatesDir)
      .filter((file) => file.endsWith(".html"));

    expect(htmlTemplates.length).toBeGreaterThan(0);

    for (const file of htmlTemplates) {
      const html = fs.readFileSync(path.join(templatesDir, file), "utf-8");
      expect(html, `${file} should include stable header URL`).toContain(HEADER_URL);
      expect(html, `${file} should not use relative image paths`).not.toMatch(/src="\/[^"]+"/);
      expect(html, `${file} should not include known typo'd header filename`).not.toContain("CSCEmaiHeader1.png");
    }
  });

  it("confirm and recovery templates include required placeholders", () => {
    const confirmHtml = fs.readFileSync(path.join(templatesDir, "confirm_email.html"), "utf-8");
    const recoveryHtml = fs.readFileSync(path.join(templatesDir, "recovery.html"), "utf-8");

    expect(confirmHtml).toContain("{{ .ConfirmationURL }}");
    expect(confirmHtml).toContain("{{ .Email }}");
    expect(confirmHtml).not.toContain("{{ .email }}");

    expect(recoveryHtml).toContain("{{ .ConfirmationURL }}");
    expect(recoveryHtml).toContain("{{ .Email }}");
  });
});
