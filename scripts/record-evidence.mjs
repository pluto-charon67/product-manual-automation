#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { appendJsonLine, isoNow, parseArgs, readJson, requireArg, writeJsonAtomic } from "./lib/common.mjs";

const forbiddenKeys = /(^|_)(password|passwd|token|cookie|secret|authorization|credential|connectionstring|connection_string)($|_)/i;

function rejectSecrets(value, location = "event") {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectSecrets(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenKeys.test(key)) throw new Error(`Secret-bearing field is not allowed at ${location}.${key}`);
    rejectSecrets(item, `${location}.${key}`);
  }
}

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const eventFile = path.resolve(requireArg(args, "event-file"));
const event = JSON.parse(await fs.readFile(eventFile, "utf8"));
rejectSecrets(event);

const manualRoot = path.join(project, ".product-manual");
const enriched = { schemaVersion: 1, recordedAt: isoNow(), ...event };
await appendJsonLine(path.join(manualRoot, "evidence-log.jsonl"), enriched);

const runStatePath = path.join(manualRoot, "run-state.json");
const runState = await readJson(runStatePath, {});
runState.updatedAt = enriched.recordedAt;
if (event.type === "gate" && event.gate && event.status) runState.gates = { ...(runState.gates ?? {}), [event.gate]: event.status };
if (event.type === "publication" && event.publicationStatus) runState.status = event.publicationStatus;
if (event.type === "scope-change") {
  runState.scopeRevision = Number(runState.scopeRevision ?? 0) + 1;
  runState.gates = { gate1: "pending", gate2: "pending", gate3: runState.gates?.gate3 ?? "pending", gate4: "pending" };
}
await writeJsonAtomic(runStatePath, runState);
process.stdout.write(`${JSON.stringify(enriched, null, 2)}\n`);
