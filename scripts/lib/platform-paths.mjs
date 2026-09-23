import os from "node:os";
import path from "node:path";

function pathApiFor(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function uniquePaths(values, platform) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const candidate = value.trim();
    const key = platform === "win32" ? candidate.toLowerCase() : candidate;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export function userHomeDirectory({ platform = process.platform, env = process.env, homedir = os.homedir() } = {}) {
  if (typeof homedir === "string" && homedir.trim()) return homedir.trim();
  if (platform === "win32") {
    if (env.USERPROFILE) return env.USERPROFILE;
    if (env.HOMEDRIVE && env.HOMEPATH) return `${env.HOMEDRIVE}${env.HOMEPATH}`;
  }
  return env.HOME ?? env.USERPROFILE ?? "";
}

export function wechatDevtoolsCandidates({ platform = process.platform, env = process.env, homedir } = {}) {
  const home = userHomeDirectory({ platform, env, homedir });
  const pathApi = pathApiFor(platform);
  const overrides = [
    env.PRODUCT_MANUAL_WECHAT_DEVTOOLS_PATH,
    env.WECHAT_DEVTOOLS_PATH,
  ];
  let defaults = [];

  if (platform === "darwin") {
    defaults = [
      "/Applications/wechatwebdevtools.app",
      "/Applications/微信开发者工具.app",
      home && pathApi.join(home, "Applications", "wechatwebdevtools.app"),
      home && pathApi.join(home, "Applications", "微信开发者工具.app"),
    ];
  } else if (platform === "win32") {
    const programRoots = uniquePaths([
      env.ProgramW6432,
      env.ProgramFiles,
      env["ProgramFiles(x86)"],
    ], platform);
    const localAppData = env.LOCALAPPDATA || (home && pathApi.join(home, "AppData", "Local"));
    defaults = [
      ...programRoots.flatMap((root) => [
        pathApi.join(root, "Tencent", "微信开发者工具"),
        pathApi.join(root, "Tencent", "微信web开发者工具"),
      ]),
      localAppData && pathApi.join(localAppData, "微信开发者工具"),
      localAppData && pathApi.join(localAppData, "Programs", "微信开发者工具"),
      localAppData && pathApi.join(localAppData, "Programs", "wechat-devtools"),
    ];
  }

  return uniquePaths([...overrides, ...defaults], platform);
}

export function wechatideSkillCandidates({ platform = process.platform, env = process.env, homedir } = {}) {
  const home = userHomeDirectory({ platform, env, homedir });
  if (!home) return [];
  const pathApi = pathApiFor(platform);
  return [
    pathApi.join(home, ".codex", "skills", "wechatide-skill", "SKILL.md"),
    pathApi.join(home, ".agents", "skills", "wechatide-skill", "SKILL.md"),
  ];
}
