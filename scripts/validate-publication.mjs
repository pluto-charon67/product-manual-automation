#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { assertUnique, parseArgs, pathExists, readJson, requireArg, resolveInside } from "./lib/common.mjs";
import { loadReviewState, pendingReviewSummary } from "./lib/review-state.mjs";

async function loadOperations(directory) {
  const result = [];
  if (!(await pathExists(directory))) return result;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) result.push(await readJson(path.join(directory, entry.name)));
  }
  return result;
}

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const strict = Boolean(args.strict);
const manualRoot = path.join(project, ".product-manual");
const projectConfig = await readJson(path.join(manualRoot, "config", "project.json"));
const privacy = await readJson(path.join(manualRoot, "config", "privacy-policy.json"));
const runState = await readJson(path.join(manualRoot, "run-state.json"));
const graph = await readJson(path.join(manualRoot, "capability-graph.json"));
const coverage = await readJson(path.join(manualRoot, "coverage.json"));
const captureManifest = await readJson(path.join(manualRoot, "capture-manifest.json"));
const reviewState = await loadReviewState(project);
const operations = await loadOperations(path.join(project, ".product-manual-plan", "operations"));
const errors = [];
const warnings = [];

try { assertUnique(graph.capabilities ?? [], "id", "Capability ID"); } catch (error) { errors.push(error.message); }
try { assertUnique(operations, "id", "Operation ID"); } catch (error) { errors.push(error.message); }

if (privacy.status !== "confirmed") errors.push("Privacy policy is not confirmed.");
if (strict) {
  for (const gate of ["gate1", "gate2", "gate4"]) if (runState.gates?.[gate] !== "confirmed") errors.push(`${gate} is not confirmed.`);
  if (!["confirmed", "restricted", "read-only", "declined"].includes(runState.gates?.gate3)) errors.push("gate3 authorization boundary is not recorded.");
}

const operationMap = new Map(operations.map((operation) => [operation.id, operation]));
for (const capability of graph.capabilities ?? []) {
  const entry = (coverage.entries ?? []).find((candidate) => candidate.capabilityId === capability.id);
  if (!entry) errors.push(`Capability ${capability.id} has no coverage entry.`);
  else if (capability.disposition === "included" && (!entry.operationId || !operationMap.has(entry.operationId))) errors.push(`Included capability ${capability.id} has no valid Operation mapping.`);
}

for (const operation of operations) {
  if (operation.publication === "excluded") continue;
  if (!operation.scenario?.trim()) errors.push(`${operation.id} is missing scenario.`);
  if (!operation.result?.trim()) errors.push(`${operation.id} is missing visible result.`);
  if (!operation.moduleId || !operation.moduleName) errors.push(`${operation.id} is missing module identity.`);
  for (const [platform, variant] of Object.entries(operation.platformVariants ?? {})) {
    if (!variant.entryPath?.trim()) errors.push(`${operation.id}/${platform} is missing a self-contained entry path.`);
    const transitions = variant.transitions ?? [];
    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index];
      if (!transition.id || !transition.fromState || !transition.toState || !transition.target) errors.push(`${operation.id}/${platform} transition ${index + 1} is incomplete.`);
      if (index > 0 && transitions[index - 1].toState !== transition.fromState) errors.push(`${operation.id}/${platform} transition continuity breaks before ${transition.id}.`);
      if (!transition.beforeCaptureId || !transition.afterCaptureId) errors.push(`${operation.id}/${platform}/${transition.id} is missing before/after capture IDs.`);
    }
    if (!(variant.sequenceImages ?? []).length) errors.push(`${operation.id}/${platform} has no sequence image.`);
    for (const image of variant.sequenceImages ?? []) {
      if (!image.toLowerCase().endsWith(".png")) errors.push(`${operation.id}/${platform} sequence is not PNG: ${image}`);
      else if (!(await pathExists(resolveInside(project, image)))) errors.push(`${operation.id}/${platform} sequence image does not exist: ${image}`);
    }
  }
}

const captureIds = new Set((captureManifest.captures ?? []).map((capture) => capture.id));
for (const operation of operations) {
  for (const variant of Object.values(operation.platformVariants ?? {})) {
    for (const transition of variant.transitions ?? []) {
      for (const id of [transition.beforeCaptureId, transition.afterCaptureId].filter(Boolean)) if (!captureIds.has(id)) errors.push(`Capture manifest is missing ${id}.`);
    }
  }
}

const summary = pendingReviewSummary(reviewState);
if (strict && reviewState.mode !== "none" && summary.pendingCaptures) errors.push(`${summary.pendingCaptures} publication captures are still pending review.`);
if (strict && summary.rejectedCaptures) errors.push(`${summary.rejectedCaptures} publication captures are rejected.`);
if (reviewState.mode === "none") warnings.push("Screenshot review is disabled for this project.");

for (const platform of projectConfig.platforms ?? []) {
  const manual = path.join(project, "docs", "product-manual", platform, "user-manual.md");
  if (!(await pathExists(manual))) errors.push(`Rendered manual is missing for platform ${platform}.`);
  else {
    const text = await fs.readFile(manual, "utf8");
    for (const operation of operations.filter((item) => item.platformVariants?.[platform] && item.publication !== "excluded")) {
      if (!text.includes(operation.title)) errors.push(`Rendered ${platform} manual is missing operation ${operation.id}.`);
      if (!text.includes("操作步骤截图")) errors.push(`Rendered ${platform} manual is missing screenshot heading.`);
    }
  }
}

const result = { valid: errors.length === 0, strict, errors, warnings, counts: { operations: operations.length, capabilities: graph.capabilities?.length ?? 0, captures: captureManifest.captures?.length ?? 0, pendingReview: summary.pendingCaptures } };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
