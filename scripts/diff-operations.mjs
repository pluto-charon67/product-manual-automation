#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isoNow, parseArgs, readJson, requireArg, writeJsonAtomic } from "./lib/common.mjs";

async function loadOperations(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) {
    const value = await readJson(target);
    return Array.isArray(value) ? value : value.operations ?? [];
  }
  const operations = [];
  for (const entry of await fs.readdir(target, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    operations.push(await readJson(path.join(target, entry.name)));
  }
  return operations;
}

const args = parseArgs();
const current = await loadOperations(path.resolve(requireArg(args, "current")));
const candidate = await loadOperations(path.resolve(requireArg(args, "candidate")));
const output = path.resolve(requireArg(args, "output"));
const currentMap = new Map(current.map((item) => [item.id, item]));
const candidateMap = new Map(candidate.map((item) => [item.id, item]));
const added = candidate.filter((item) => !currentMap.has(item.id)).map((item) => item.id);
const removed = current.filter((item) => !candidateMap.has(item.id)).map((item) => item.id);
const changed = [];
for (const item of candidate) {
  const before = currentMap.get(item.id);
  if (!before) continue;
  const normalizedBefore = JSON.stringify({ ...before, updatedAt: undefined });
  const normalizedAfter = JSON.stringify({ ...item, updatedAt: undefined });
  if (normalizedBefore !== normalizedAfter) changed.push(item.id);
}
const impacted = new Set([...added, ...removed, ...changed]);
const changedSharedEntries = new Set(candidate.filter((item) => changed.includes(item.id)).flatMap((item) => item.sharedEntryDependencies ?? []));
for (const item of candidate) {
  if ((item.sharedEntryDependencies ?? []).some((entry) => changedSharedEntries.has(entry))) impacted.add(item.id);
}
const result = { schemaVersion: 1, generatedAt: isoNow(), added, removed, changed, impacted: [...impacted] };
await writeJsonAtomic(output, result);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
