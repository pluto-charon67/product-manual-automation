#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isoNow, parseArgs, readJson, requireArg, writeJsonAtomic } from "./lib/common.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const graph = await readJson(path.join(project, ".product-manual", "capability-graph.json"));
const coveragePath = path.join(project, ".product-manual", "coverage.json");
const coverage = await readJson(coveragePath, { schemaVersion: 1, entries: [] });
const entryMap = new Map((coverage.entries ?? []).map((entry) => [entry.capabilityId, entry]));
coverage.generatedAt = isoNow();
coverage.entries = (graph.capabilities ?? []).map((capability) => ({
  capabilityId: capability.id,
  label: capability.label,
  moduleId: capability.moduleId,
  platform: capability.platform,
  disposition: capability.disposition,
  operationId: entryMap.get(capability.id)?.operationId ?? null,
  manualSection: entryMap.get(capability.id)?.manualSection ?? null,
  execution: entryMap.get(capability.id)?.execution ?? capability.execution ?? "not-run",
  publication: entryMap.get(capability.id)?.publication ?? capability.publication ?? "draft"
}));
await writeJsonAtomic(coveragePath, coverage);
const lines = ["# Coverage", "", `Generated: ${coverage.generatedAt}`, "", "| Capability | Platform | Disposition | Operation | Execution | Publication |", "| --- | --- | --- | --- | --- | --- |"];
for (const entry of coverage.entries) lines.push(`| ${entry.label} (${entry.capabilityId}) | ${entry.platform} | ${entry.disposition} | ${entry.operationId ?? "-"} | ${entry.execution} | ${entry.publication} |`);
await fs.writeFile(path.join(project, ".product-manual-plan", "coverage.md"), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ entries: coverage.entries.length }, null, 2)}\n`);
