import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf-8");

const actionsSource = read("app/(protected)/dashboard/admin/users/actions.ts");
const tableSource = read("components/admin/UserDirectoryTable.tsx");

describe("Admin user toggles: host sync + UI feedback", () => {
  it("toggleHostStatus syncs approved_hosts when enabling host", () => {
    expect(actionsSource).toContain('.from("approved_hosts")');
    expect(actionsSource).toContain(".upsert(");
    expect(actionsSource).toContain('status: "active"');
  });

  it("toggleHostStatus revokes approved_hosts when disabling host", () => {
    expect(actionsSource).toContain('.update({');
    expect(actionsSource).toContain('status: "revoked"');
    expect(actionsSource).toContain('.eq("user_id", userId)');
  });

  it("toggleHostStatus updates profiles.is_host in the same action", () => {
    expect(actionsSource).toContain('.from("profiles")');
    expect(actionsSource).toContain(".update({ is_host: isHost })");
  });

  it("UserDirectoryTable has visible success/error notice state", () => {
    expect(tableSource).toContain("const [actionNotice, setActionNotice] = useState");
    expect(tableSource).toContain('{actionNotice && (');
    expect(tableSource).toContain('actionNotice.type === "success"');
  });

  it("spotlight and host/admin toggle handlers set feedback messages", () => {
    expect(tableSource).toContain("setActionNotice({ type: \"error\"");
    expect(tableSource).toContain("setActionNotice({");
    expect(tableSource).toContain("result.message || (newHostStatus ? \"Host enabled.\" : \"Host disabled.\")");
    expect(tableSource).toContain("Admin role granted.");
  });
});
