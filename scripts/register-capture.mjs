#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, isoNow, parseArgs, pathExists, readJson, relativePortable, requireArg, sha256File, writeJsonAtomic } from "./lib/common.mjs";
import { loadReviewState, saveReviewState } from "./lib/review-state.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const source = path.resolve(requireArg(args, "capture"));
const metadata = JSON.parse(await fs.readFile(path.resolve(requireArg(args, "metadata")), "utf8"));
for (const field of ["id", "moduleId", "operationId", "variantId", "platform", "transitionId", "stateId", "role"]) {
  if (!metadata[field]) throw new Error(`Capture metadata is missing ${field}`);
}
if (!["before-action", "after-transition", "result"].includes(metadata.role)) throw new Error("Capture role must be before-action, after-transition, or result");
if (path.extname(source).toLowerCase() !== ".png") throw new Error("Raw publication evidence must be a PNG file");

const privacy = await readJson(path.join(project, ".product-manual", "config", "privacy-policy.json"));
if (privacy.status !== "confirmed") throw new Error("Privacy policy must be confirmed before registering publication captures");
const rawRoot = path.join(project, ".product-manual", "images", "raw", metadata.moduleId, metadata.operationId);
await ensureDir(rawRoot);
const rawTarget = path.join(rawRoot, `${metadata.id}.png`);
const sourceHash = await sha256File(source);
if (await pathExists(rawTarget)) {
  const existingHash = await sha256File(rawTarget);
  if (existingHash !== sourceHash) throw new Error(`Immutable raw capture already exists with different content: ${metadata.id}`);
} else {
  await fs.copyFile(source, rawTarget, fs.constants.COPYFILE_EXCL);
}

const manualRoot = path.join(project, ".product-manual");
const manifestPath = path.join(manualRoot, "capture-manifest.json");
const manifest = await readJson(manifestPath, { schemaVersion: 1, captures: [], sequences: [] });
const existing = manifest.captures.find((capture) => capture.id === metadata.id);
const captureEntry = {
  ...metadata,
  rawPath: relativePortable(project, rawTarget),
  rawHash: sourceHash,
  capturedAt: metadata.capturedAt ?? isoNow(),
  registeredAt: isoNow(),
  privacyPolicyRevision: privacy.revision,
  privacyStatus: "pending-review",
  status: "registered",
  published: false
};
if (existing && existing.rawHash !== sourceHash) throw new Error(`Capture manifest ID collision: ${metadata.id}`);
if (!existing) manifest.captures.push(captureEntry);
await writeJsonAtomic(manifestPath, manifest);

const review = await loadReviewState(project);
if (!review.captures.some((capture) => capture.id === metadata.id)) {
  review.captures.push({
    id: metadata.id,
    operationId: metadata.operationId,
    variantId: metadata.variantId,
    platform: metadata.platform,
    transitionId: metadata.transitionId,
    role: metadata.role,
    rawPath: captureEntry.rawPath,
    redactedPath: `.product-manual/images/redacted/${metadata.id}.png`,
    annotatedPath: `.product-manual/images/annotated/${metadata.id}.png`,
    imagePath: captureEntry.rawPath,
    revision: 1,
    status: review.mode === "none" ? "bypassed" : "pending",
    derivedStatus: "stale",
    privacyPolicyRevision: privacy.revision,
    annotations: (metadata.annotations ?? []).map((item, index) => ({ ...item, id: item.id ?? `ANN-${metadata.id}-${index + 1}`, revision: item.revision ?? 1, status: review.mode === "none" ? "bypassed" : "pending", source: item.source ?? "manual", confidence: item.confidence ?? 1 })),
    redactions: (metadata.redactions ?? []).map((item, index) => ({ ...item, id: item.id ?? `RED-${metadata.id}-${index + 1}`, revision: item.revision ?? 1, status: review.mode === "none" ? "bypassed" : "pending", source: item.source ?? "manual", confidence: item.confidence ?? 1 })),
    createdAt: isoNow(),
    updatedAt: isoNow()
  });
}
await saveReviewState(project, review);
process.stdout.write(`${JSON.stringify(captureEntry, null, 2)}\n`);
