import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Supabase confirm email template", () => {
  it("uses an absolute, stable header image URL", () => {
    const templatePath = path.join(process.cwd(), "..", "supabase", "templates", "confirm_email.html");
    const html = fs.readFileSync(templatePath, "utf-8");

    expect(html).toContain("https://coloradosongwriterscollective.org/images/CSCEmailHeader1.png");
    expect(html).not.toMatch(/src="\/[^"]+"/); // no relative image URLs
  });

  it("contains required Supabase confirmation placeholder", () => {
    const templatePath = path.join(process.cwd(), "..", "supabase", "templates", "confirm_email.html");
    const html = fs.readFileSync(templatePath, "utf-8");
    expect(html).toContain("{{ .ConfirmationURL }}");
  });
});
