#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  copyJsonTemplate,
  ensureDir,
  isoNow,
  parseArgs,
  requireArg,
  writeJsonIfMissing,
} from "./lib/common.mjs";

const args = parseArgs();
const repositoryRoot = path.resolve(requireArg(args, "project"));
const platforms = String(args.platforms ?? "wechat,web")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => ["wechat", "web"].includes(value));

if (!platforms.length) throw new Error("--platforms must include wechat and/or web");

const manualRoot = path.join(repositoryRoot, ".product-manual");
const planRoot = path.join(repositoryRoot, ".product-manual-plan");
const outputRoot = path.join(repositoryRoot, "docs", "product-manual");

for (const directory of [
  path.join(manualRoot, "config"),
  path.join(manualRoot, "history"),
  path.join(manualRoot, "automation"),
  path.join(manualRoot, "images", "raw"),
  path.join(manualRoot, "images", "redacted"),
  path.join(manualRoot, "images", "redactions"),
  path.join(manualRoot, "images", "annotations"),
  path.join(manualRoot, "images", "annotated"),
  path.join(manualRoot, "images", "sequences"),
  path.join(planRoot, "modules"),
  path.join(planRoot, "business-nodes"),
  path.join(planRoot, "operations"),
  path.join(planRoot, "platform-variants"),
  outputRoot,
  ...platforms.map((platform) => path.join(outputRoot, platform, "images", "sequences")),
]) {
  await ensureDir(directory);
}

const projectConfig = await copyJsonTemplate("default-project-config.json");
projectConfig.projectName = path.basename(repositoryRoot);
projectConfig.platforms = platforms;
projectConfig.repositoryRoot = repositoryRoot;

const created = [];
async function seed(relativePath, value) {
  const target = path.join(manualRoot, relativePath);
  if (await writeJsonIfMissing(target, value)) created.push(target);
}

await seed("config/project.json", projectConfig);
await seed("config/template.json", await copyJsonTemplate("default-template-config.json"));
await seed("config/privacy-policy.json", await copyJsonTemplate("default-privacy-policy.json"));
await seed("config/visual-policy.json", await copyJsonTemplate("default-visual-policy.json"));
await seed("config/database-profiles.json", { schemaVersion: 1, profiles: [] });
await seed("project-inventory.json", { schemaVersion: 1, generatedAt: null, detections: [] });
await seed("capability-graph.json", { schemaVersion: 1, scopeRevision: 1, modules: [], capabilities: [], operations: [] });
await seed("coverage.json", { schemaVersion: 1, generatedAt: null, entries: [] });
await seed("capture-manifest.json", { schemaVersion: 1, captures: [], sequences: [] });
await seed("review-state.json", { schemaVersion: 1, mode: "all", updatedAt: isoNow(), captures: [] });
await seed("run-state.json", {
  schemaVersion: 1,
  status: "planning",
  scopeRevision: 1,
  activeModuleId: null,
  gates: {
    gate1: "pending",
    gate2: "pending",
    gate3: "pending",
    gate4: "pending"
  },
  updatedAt: isoNow()
});
await seed("test-data.json", { schemaVersion: 1, records: [] });
await seed("database-evidence.json", { schemaVersion: 1, events: [] });

const evidenceLog = path.join(manualRoot, "evidence-log.jsonl");
try {
  await fs.access(evidenceLog);
} catch {
  await fs.writeFile(evidenceLog, "", "utf8");
  created.push(evidenceLog);
}

for (const file of ["coverage.md", "review-decisions.md"]) {
  const target = path.join(planRoot, file);
  try {
    await fs.access(target);
  } catch {
    await fs.writeFile(target, file === "coverage.md" ? "# Coverage\n" : "# Review decisions\n", "utf8");
    created.push(target);
  }
}

process.stdout.write(`${JSON.stringify({ repositoryRoot, manualRoot, planRoot, outputRoot, platforms, created }, null, 2)}\n`);
