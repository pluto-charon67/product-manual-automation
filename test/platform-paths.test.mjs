import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { relativePortable, resolveInside } from "../scripts/lib/common.mjs";
import { userHomeDirectory, wechatDevtoolsCandidates, wechatideSkillCandidates } from "../scripts/lib/platform-paths.mjs";

test("macOS candidates use os.homedir and accept an explicit override", () => {
  const candidates = wechatDevtoolsCandidates({
    platform: "darwin",
    homedir: "/Users/tester",
    env: { PRODUCT_MANUAL_WECHAT_DEVTOOLS_PATH: "/Volumes/Tools/微信开发者工具.app" },
  });
  assert.equal(candidates[0], "/Volumes/Tools/微信开发者工具.app");
  assert.ok(candidates.includes("/Applications/微信开发者工具.app"));
  assert.ok(candidates.includes("/Users/tester/Applications/微信开发者工具.app"));
});

test("Windows candidates use native drive and user-profile paths", () => {
  const env = {
    USERPROFILE: "C:\\Users\\tester",
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
    LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local",
    PRODUCT_MANUAL_WECHAT_DEVTOOLS_PATH: "D:\\Tools\\微信开发者工具",
  };
  const candidates = wechatDevtoolsCandidates({ platform: "win32", homedir: "C:\\Users\\tester", env });
  assert.equal(candidates[0], "D:\\Tools\\微信开发者工具");
  assert.ok(candidates.includes("C:\\Program Files (x86)\\Tencent\\微信web开发者工具"));
  assert.ok(candidates.includes("C:\\Users\\tester\\AppData\\Local\\Programs\\微信开发者工具"));
  assert.deepEqual(wechatideSkillCandidates({ platform: "win32", homedir: "C:\\Users\\tester", env }), [
    "C:\\Users\\tester\\.codex\\skills\\wechatide-skill\\SKILL.md",
    "C:\\Users\\tester\\.agents\\skills\\wechatide-skill\\SKILL.md",
  ]);
});

test("Windows home falls back to USERPROFILE when homedir is unavailable", () => {
  assert.equal(userHomeDirectory({ platform: "win32", homedir: "", env: { USERPROFILE: "C:\\Users\\tester" } }), "C:\\Users\\tester");
});

test("portable paths retain forward slashes and containment works case-insensitively on Windows", () => {
  assert.equal(relativePortable("C:\\Projects\\Product", "C:\\Projects\\Product\\docs\\manual.md", path.win32), "docs/manual.md");
  assert.equal(resolveInside("C:\\Projects\\Product", "c:\\projects\\product\\docs\\manual.md", path.win32), "c:\\projects\\product\\docs\\manual.md");
  assert.throws(() => resolveInside("C:\\Projects\\Product", "C:\\Projects\\Other\\secret.txt", path.win32), /Path escapes allowed root/);
});
