#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  isoNow,
  latestMtime,
  parseArgs,
  pathExists,
  readJson,
  requireArg,
  walkFiles,
  writeJsonAtomic,
} from "./lib/common.mjs";

const args = parseArgs();
const repositoryRoot = path.resolve(requireArg(args, "project"));
const output = path.resolve(args.output ?? path.join(repositoryRoot, ".product-manual", "project-inventory.json"));
const files = await walkFiles(repositoryRoot, { ignore: [".git", ".product-manual", ".product-manual-plan", "node_modules", "coverage"] });
const relative = files.map((file) => path.relative(repositoryRoot, file).split(path.sep).join("/"));
const relativeSet = new Set(relative);
const packageJson = await readJson(path.join(repositoryRoot, "package.json"), {});
const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };

const projectConfigPath = relative.find((file) => file.endsWith("project.config.json"));
let nativeRoot = null;
if (projectConfigPath) {
  const projectConfig = await readJson(path.join(repositoryRoot, projectConfigPath), {});
  nativeRoot = path.resolve(path.dirname(path.join(repositoryRoot, projectConfigPath)), projectConfig.miniprogramRoot ?? ".");
}

const uniMarkers = ["@dcloudio/uni-app", "uni-app", "@uni-helper/vite-plugin-uni-pages"];
const isUniApp = uniMarkers.some((name) => dependencies[name]) || relativeSet.has("pages.json") || relativeSet.has("src/pages.json") || relativeSet.has("pages.config.ts");
const compiledCandidates = [
  "dist/dev/mp-weixin",
  "dist/build/mp-weixin",
  "unpackage/dist/dev/mp-weixin",
  "unpackage/dist/build/mp-weixin",
].map((candidate) => path.join(repositoryRoot, candidate));
const compiledExisting = [];
for (const candidate of compiledCandidates) if (await pathExists(candidate)) compiledExisting.push(candidate);

const sourceCandidates = files.filter((file) => /\.(vue|tsx?|jsx?|json|wxml|wxss)$/.test(file) && !file.includes(`${path.sep}dist${path.sep}`) && !file.includes(`${path.sep}unpackage${path.sep}`));
const compiledFiles = [];
for (const root of compiledExisting) compiledFiles.push(...await walkFiles(root, { ignore: ["node_modules"] }));
const sourceMtime = await latestMtime(sourceCandidates);
const compiledMtime = await latestMtime(compiledFiles);

const webFrameworks = Object.keys(dependencies).filter((name) => /^(react|react-dom|vue|@angular\/core|next|nuxt|vite|svelte)$/.test(name));
const hasWebSource = relative.some((file) => /^(src|app|pages)\/.+\.(tsx?|jsx?|vue|svelte|html)$/.test(file)) || relativeSet.has("index.html");

const detections = [];
if (projectConfigPath && nativeRoot) {
  detections.push({ platform: "wechat", kind: "native-miniprogram", confidence: 1, sourceRoot: nativeRoot, wechatProject: nativeRoot });
}
if (isUniApp) {
  detections.push({
    platform: "wechat",
    kind: "uni-app",
    confidence: 0.95,
    sourceRoot: await pathExists(path.join(repositoryRoot, "src")) ? path.join(repositoryRoot, "src") : repositoryRoot,
    wechatProject: compiledExisting[0] ?? null,
    compiledCandidates,
    compiledFreshness: compiledExisting.length === 0 ? "missing" : sourceMtime > compiledMtime ? "stale" : "fresh"
  });
}
if (hasWebSource || webFrameworks.length) {
  detections.push({ platform: "web", kind: "desktop-web", confidence: webFrameworks.length ? 0.95 : 0.7, frameworks: webFrameworks, sourceRoot: repositoryRoot });
}

const inventory = {
  schemaVersion: 1,
  generatedAt: isoNow(),
  repositoryRoot,
  packageManager: relativeSet.has("pnpm-lock.yaml") ? "pnpm" : relativeSet.has("yarn.lock") ? "yarn" : relativeSet.has("package-lock.json") ? "npm" : null,
  detections,
  warnings: [
    ...(isUniApp && compiledExisting.length === 0 ? ["uni-app WeChat output is missing; runtime verification is blocked until mp-weixin is built."] : []),
    ...(isUniApp && compiledExisting.length > 0 && sourceMtime > compiledMtime ? ["uni-app WeChat output is older than source files; rebuild before runtime verification."] : []),
  ]
};

await writeJsonAtomic(output, inventory);
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
