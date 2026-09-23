#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { isoNow, parseArgs, readJson, requireArg } from "./lib/common.mjs";
import { findCapture, loadReviewState, saveReviewState } from "./lib/review-state.mjs";

const sourceWeight = {
  "dom-geometry": 1,
  "playwright-geometry": 1,
  "wechat-geometry": 1,
  "cdp-geometry": 0.98,
  "ocr-paddle": 0.78,
  omniparser: 0.7,
  vision: 0.62,
  manual: 1
};

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const proposal = JSON.parse(await fs.readFile(path.resolve(requireArg(args, "proposal")), "utf8"));
if (!proposal.captureId || !Array.isArray(proposal.candidates) || !proposal.candidates.length) throw new Error("Proposal requires captureId and non-empty candidates");
const visual = await readJson(path.join(project, ".product-manual", "config", "visual-policy.json"));
const state = await loadReviewState(project);
const capture = findCapture(state, proposal.captureId);
const ranked = proposal.candidates
  .filter((candidate) => candidate.target && Number(candidate.target.width) > 0 && Number(candidate.target.height) > 0)
  .map((candidate) => ({ ...candidate, score: Number(candidate.confidence ?? 0.5) * Number(sourceWeight[candidate.source] ?? 0.5) }))
  .sort((left, right) => right.score - left.score);
if (!ranked.length) throw new Error("Proposal contains no valid target geometry");
const selected = ranked[0];
const threshold = Number(visual.confidenceThreshold ?? 0.9);
const annotation = {
  id: proposal.annotationId ?? `ANN-${proposal.captureId}-${proposal.number ?? (capture.annotations?.length ?? 0) + 1}`,
  number: Number(proposal.number ?? (capture.annotations?.length ?? 0) + 1),
  label: proposal.label ?? selected.label ?? null,
  target: selected.target,
  labelPoint: proposal.labelPoint ?? { x: Math.max(22, selected.target.x - 50), y: Math.max(22, selected.target.y - 40) },
  targetScope: selected.targetScope ?? "control",
  source: selected.source,
  confidence: selected.confidence ?? selected.score,
  candidates: ranked.map(({ score, ...candidate }) => ({ ...candidate, score })),
  requiresReview: state.mode === "all" || selected.score < threshold || !["dom-geometry", "playwright-geometry", "wechat-geometry", "cdp-geometry", "manual"].includes(selected.source),
  revision: 1,
  status: state.mode === "none" ? "bypassed" : "pending",
  createdAt: isoNow()
};
capture.annotations ??= [];
const existingIndex = capture.annotations.findIndex((item) => item.id === annotation.id);
if (existingIndex >= 0) {
  annotation.revision = Number(capture.annotations[existingIndex].revision ?? 1) + 1;
  capture.annotations[existingIndex] = annotation;
} else capture.annotations.push(annotation);
capture.status = state.mode === "none" ? "bypassed" : "pending";
capture.derivedStatus = "stale";
capture.updatedAt = isoNow();
await saveReviewState(project, state);
process.stdout.write(`${JSON.stringify({ selected, annotation, alternatives: ranked.slice(1) }, null, 2)}\n`);
