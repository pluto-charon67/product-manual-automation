#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isoNow, parseArgs, relativePortable, requireArg, stableId, walkFiles, writeJsonAtomic } from "./lib/common.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const output = path.resolve(args.output ?? path.join(project, ".product-manual", "web-inventory.json"));
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".html"]);
const files = (await walkFiles(project)).filter((file) => extensions.has(path.extname(file)));
const pages = [];
const affordances = [];
const routes = [];
const apiCandidates = [];
const errorCandidates = [];

const routePatterns = [
  /(?:path|url)\s*[:=]\s*["'`]([^"'`]+)["'`]/g,
  /(?:navigate|push|replace)\s*\(\s*["'`]([^"'`]+)["'`]/g,
  /<Route[^>]+path=["'{`]([^"'`}]+)["'`}]/g,
];
const controlPattern = /<(button|a|input|select|textarea|el-button|a-button|van-button)[^>]*>([\s\S]{0,160}?)<\/\1>|<(input|button)[^>]*(?:aria-label|title|value|placeholder)=["']([^"']+)["'][^>]*>/gi;
const clickPattern = /(?:@click|onClick|onclick|onSubmit|@submit|onChange)\s*=\s*["'{]([^"'}]+)["'}]/gi;
const apiPattern = /(?:fetch|axios\.(?:get|post|put|patch|delete)|request|http\.(?:get|post|put|patch|delete))\s*\(\s*["'`]([^"'`]+)["'`]/g;
const messagePattern = /(?:message|toast|notify|alert|error)\s*\(\s*["'`]([^"'`]{4,120})["'`]/gi;

for (const file of files) {
  let source;
  try {
    source = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }
  const relativePath = relativePortable(project, file);
  if (/\/(pages?|views?|routes?)\//i.test(`/${relativePath}`) || /(?:page|view|route)\.(?:jsx?|tsx?|vue|svelte)$/i.test(relativePath)) {
    pages.push({ id: stableId("PAGE", relativePath), file: relativePath });
  }
  for (const pattern of routePatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const route = match[1]?.trim();
      if (route && !route.startsWith("http")) routes.push({ id: stableId("ROUTE", route), path: route, file: relativePath });
    }
  }
  controlPattern.lastIndex = 0;
  for (const match of source.matchAll(controlPattern)) {
    const raw = (match[2] ?? match[4] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!raw || raw.length > 80 || /[{<]/.test(raw)) continue;
    affordances.push({ id: stableId("AFF", relativePath, raw), label: raw, file: relativePath, region: "content", outcome: "unresolved" });
  }
  clickPattern.lastIndex = 0;
  for (const match of source.matchAll(clickPattern)) {
    const handler = match[1]?.replace(/\s+/g, " ").trim();
    if (handler) affordances.push({ id: stableId("AFF", relativePath, handler), label: null, handler, file: relativePath, region: "unresolved", outcome: "unresolved" });
  }
  apiPattern.lastIndex = 0;
  for (const match of source.matchAll(apiPattern)) apiCandidates.push({ id: stableId("API", match[1]), path: match[1], file: relativePath });
  messagePattern.lastIndex = 0;
  for (const match of source.matchAll(messagePattern)) errorCandidates.push({ id: stableId("MSG", match[1]), message: match[1], file: relativePath });
}

function uniqueBy(items, key) {
  return [...new Map(items.map((item) => [item[key], item])).values()];
}

const inventory = {
  schemaVersion: 1,
  platform: "web",
  generatedAt: isoNow(),
  project,
  pages: uniqueBy(pages, "id"),
  routes: uniqueBy(routes, "id"),
  affordances: uniqueBy(affordances, "id"),
  apiCandidates: uniqueBy(apiCandidates, "id"),
  errorCandidates: uniqueBy(errorCandidates, "id"),
  unresolved: affordances.filter((item) => !item.label || item.outcome === "unresolved").map((item) => item.id),
  notes: ["Static scanning produces candidates only. Confirm visibility, labels, state conditions, and results at runtime."]
};

await writeJsonAtomic(output, inventory);
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
