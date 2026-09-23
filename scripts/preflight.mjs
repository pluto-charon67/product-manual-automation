#!/usr/bin/env node
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { parseArgs, pathExists, requireArg } from "./lib/common.mjs";
import { wechatDevtoolsCandidates, wechatideSkillCandidates } from "./lib/platform-paths.mjs";

const execute = promisify(execFile);
const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const platforms = String(args.platforms ?? "wechat,web").split(",").map((value) => value.trim());
const checks = [];

async function commandCheck(name, command, commandArgs = ["--version"]) {
  try {
    const result = await execute(command, commandArgs, { timeout: 5000 });
    checks.push({ name, status: "passed", detail: (result.stdout || result.stderr).trim().split("\n")[0] });
  } catch (error) {
    checks.push({ name, status: "missing", detail: error.code ?? error.message });
  }
}

checks.push({ name: "project-root", status: await pathExists(project) ? "passed" : "missing", detail: project });
checks.push({ name: "workspace-initialized", status: await pathExists(path.join(project, ".product-manual", "config", "project.json")) ? "passed" : "missing", detail: ".product-manual/config/project.json" });
checks.push({ name: "node-runtime", status: Number(process.versions.node.split(".")[0]) >= 22 ? "passed" : "unsupported", detail: process.version });

if (platforms.includes("web")) {
  await commandCheck("ego-browser", "ego-browser", ["--version"]);
  try {
    await import("playwright");
    checks.push({ name: "playwright", status: "passed", detail: "Node package available" });
  } catch {
    checks.push({ name: "playwright", status: "optional-missing", detail: "Install or use an available Playwright skill when isolated web execution is required" });
  }
}
if (platforms.includes("wechat")) {
  const appCandidates = wechatDevtoolsCandidates();
  const appDetected = (await Promise.all(appCandidates.map(pathExists))).some(Boolean);
  const appDetail = appCandidates.length
    ? appCandidates.join(", ")
    : `No default installation path is defined for ${process.platform}; set PRODUCT_MANUAL_WECHAT_DEVTOOLS_PATH`;
  checks.push({ name: "wechat-devtools", status: appDetected ? "passed" : "missing", detail: appDetail });
  const skillCandidates = wechatideSkillCandidates();
  checks.push({ name: "wechatide-skill", status: (await Promise.all(skillCandidates.map(pathExists))).some(Boolean) ? "passed" : "missing", detail: skillCandidates.join(", ") });
}

const blockers = checks.filter((check) => ["missing", "unsupported"].includes(check.status) && !["ego-browser"].includes(check.name));
process.stdout.write(`${JSON.stringify({ project, platforms, ready: blockers.length === 0, checks }, null, 2)}\n`);
if (blockers.length) process.exitCode = 1;
