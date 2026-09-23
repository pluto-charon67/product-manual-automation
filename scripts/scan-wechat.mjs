#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isoNow, parseArgs, pathExists, readJson, relativePortable, requireArg, stableId, walkFiles, writeJsonAtomic } from "./lib/common.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const sourceRoot = path.resolve(args["source-root"] ?? project);
const wechatProject = args["wechat-project"] ? path.resolve(args["wechat-project"]) : project;
const output = path.resolve(args.output ?? path.join(project, ".product-manual", "wechat-inventory.json"));
const files = (await walkFiles(sourceRoot, { ignore: [".git", ".product-manual", ".product-manual-plan", "node_modules", "dist", "unpackage"] }))
  .filter((file) => /\.(wxml|wxss|js|jsx|ts|tsx|vue|json)$/.test(file));

const pages = [];
const affordances = [];
const routes = [];
const apiCandidates = [];
const messageCandidates = [];
const configCandidates = [path.join(sourceRoot, "app.json"), path.join(sourceRoot, "pages.json"), path.join(sourceRoot, "src", "pages.json")];

for (const configPath of configCandidates) {
  if (!(await pathExists(configPath))) continue;
  const config = await readJson(configPath, {});
  for (const page of config.pages ?? []) pages.push({ id: stableId("PAGE", page), route: page, source: relativePortable(project, configPath) });
  for (const subpackage of config.subPackages ?? config.subpackages ?? []) {
    for (const page of subpackage.pages ?? []) {
      const route = `${subpackage.root ?? ""}/${page}`.replace(/\/{2,}/g, "/");
      pages.push({ id: stableId("PAGE", route), route, source: relativePortable(project, configPath) });
    }
  }
}

const controlPattern = /<(button|navigator|view|text|image|van-button|uni-icons)[^>]*(?:bindtap|catchtap|@click|url|href|aria-label|title)?[^>]*>([\s\S]{0,140}?)<\/\1>/gi;
const handlerPattern = /(?:bindtap|catchtap|@click|@submit)=["']([^"']+)["']/gi;
const routePattern = /(?:wx|uni)\.(?:navigateTo|redirectTo|reLaunch|switchTab)\s*\(\s*\{[^}]*url\s*:\s*["'`]([^"'`]+)["'`]/g;
const apiPattern = /(?:wx\.request|uni\.request|request|http\.(?:get|post|put|delete))\s*\(\s*(?:\{[^}]*url\s*:\s*)?["'`]([^"'`]+)["'`]/g;
const messagePattern = /(?:title|content|message)\s*:\s*["'`]([^"'`]{2,120})["'`]/g;

for (const file of files) {
  let source;
  try {
    source = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }
  const relativePath = relativePortable(project, file);
  controlPattern.lastIndex = 0;
  for (const match of source.matchAll(controlPattern)) {
    const label = (match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/{{[^}]+}}/g, " ").replace(/\s+/g, " ").trim();
    if (label && label.length <= 80) affordances.push({ id: stableId("AFF", relativePath, label), label, file: relativePath, outcome: "unresolved" });
  }
  handlerPattern.lastIndex = 0;
  for (const match of source.matchAll(handlerPattern)) affordances.push({ id: stableId("AFF", relativePath, match[1]), handler: match[1], label: null, file: relativePath, outcome: "unresolved" });
  routePattern.lastIndex = 0;
  for (const match of source.matchAll(routePattern)) routes.push({ id: stableId("ROUTE", match[1]), path: match[1], file: relativePath });
  apiPattern.lastIndex = 0;
  for (const match of source.matchAll(apiPattern)) apiCandidates.push({ id: stableId("API", match[1]), path: match[1], file: relativePath });
  messagePattern.lastIndex = 0;
  for (const match of source.matchAll(messagePattern)) messageCandidates.push({ id: stableId("MSG", match[1]), message: match[1], file: relativePath });
}

function uniqueBy(items, key) {
  return [...new Map(items.map((item) => [item[key], item])).values()];
}

const inventory = {
  schemaVersion: 1,
  platform: "wechat",
  generatedAt: isoNow(),
  project,
  sourceRoot,
  wechatProject,
  wechatProjectExists: await pathExists(wechatProject),
  pages: uniqueBy(pages, "id"),
  routes: uniqueBy(routes, "id"),
  affordances: uniqueBy(affordances, "id"),
  apiCandidates: uniqueBy(apiCandidates, "id"),
  errorCandidates: uniqueBy(messageCandidates, "id"),
  unresolved: affordances.filter((item) => !item.label || item.outcome === "unresolved").map((item) => item.id),
  notes: ["Runtime verification must use the installed wechatide-skill and a fresh compiled project."]
};

await writeJsonAtomic(output, inventory);
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
