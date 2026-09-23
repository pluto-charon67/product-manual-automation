#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isoNow, parseArgs, relativePortable, requireArg, stableId, walkFiles, writeJsonAtomic } from "./lib/common.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const backend = path.resolve(args.backend ?? project);
const output = path.resolve(args.output ?? path.join(project, ".product-manual", "backend-inventory.json"));
const files = (await walkFiles(backend)).filter((file) => /\.(js|jsx|ts|tsx|java|kt|cs|py|php|go|rb)$/.test(file));
const endpoints = [];
const errors = [];
const validations = [];
const transitions = [];

const endpointPatterns = [
  /(?:app|router|server)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
  /@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi,
  /@(GET|POST|PUT|PATCH|DELETE)\s*["'(]([^"')]+)["')]/gi,
  /(?:HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete)\s*\(\s*["']?([^"')\]]*)/gi,
];
const errorPatterns = [
  /(?:throw\s+new\s+[A-Za-z0-9_.]*(?:Exception|Error)|raise\s+[A-Za-z0-9_.]*|abort|BadRequest|Conflict|Forbidden)\s*\([^"'`]*["'`]([^"'`]{4,180})["'`]/gi,
  /(?:message|msg|detail|error)\s*[:=]\s*["'`]([^"'`]{4,180})["'`]/gi,
];
const validationPatterns = [
  /(?:if|unless)\s*\(([^\n\r{}]{3,180})\)\s*\{?/g,
  /@(NotNull|NotBlank|Min|Max|Size|Pattern|Valid)[^\n\r]*/g,
  /(?:validate|validator|schema)\.(?:required|min|max|refine|test)\([^\n\r]{0,160}/gi,
];
const transitionPattern = /(?:status|state|stage|phase)\s*(?:=|:|->|to)\s*["'`]([A-Za-z0-9_\u4e00-\u9fff -]{2,60})["'`]/gi;

for (const file of files) {
  let source;
  try { source = await fs.readFile(file, "utf8"); } catch { continue; }
  const relativePath = relativePortable(project, file);
  for (const pattern of endpointPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const method = (match[1] ?? "UNKNOWN").toUpperCase().replace("MAPPING", "");
      const route = (match[2] ?? match[1] ?? "").trim();
      if (route) endpoints.push({ id: stableId("ENDPOINT", method, route), method, path: route, file: relativePath });
    }
  }
  for (const pattern of errorPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) errors.push({ id: stableId("ERROR", match[1]), message: match[1], file: relativePath });
  }
  for (const pattern of validationPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const expression = match[0].replace(/\s+/g, " ").trim();
      if (expression.length <= 200) validations.push({ id: stableId("VALIDATION", relativePath, expression), expression, file: relativePath });
    }
  }
  transitionPattern.lastIndex = 0;
  for (const match of source.matchAll(transitionPattern)) transitions.push({ id: stableId("STATE", relativePath, match[1]), toState: match[1].trim(), file: relativePath });
}

function uniqueBy(items, key) { return [...new Map(items.map((item) => [item[key], item])).values()]; }
const inventory = {
  schemaVersion: 1,
  kind: "backend",
  generatedAt: isoNow(),
  project,
  backend,
  endpoints: uniqueBy(endpoints, "id"),
  errorCandidates: uniqueBy(errors, "id"),
  validationCandidates: uniqueBy(validations, "id"),
  stateTransitionCandidates: uniqueBy(transitions, "id"),
  notes: ["Backend scanning identifies evidence candidates. Publish only operation-linked business rules written in non-technical language."]
};
await writeJsonAtomic(output, inventory);
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
