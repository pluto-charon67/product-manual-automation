#!/usr/bin/env node
import path from "node:path";
import { appendJsonLine, isoNow, parseArgs, requireArg } from "./lib/common.mjs";
import { loadReviewState, pendingReviewSummary, saveReviewState } from "./lib/review-state.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const mode = requireArg(args, "mode");
if (!["all", "risky", "none"].includes(mode)) throw new Error("--mode must be all, risky, or none");
const state = await loadReviewState(project);
const previousMode = state.mode;
state.mode = mode;
if (mode === "all" && previousMode !== "all") {
  for (const capture of state.captures ?? []) {
    const objects = [...(capture.annotations ?? []), ...(capture.redactions ?? [])];
    if (objects.some((item) => item.status !== "approved")) capture.status = "pending";
  }
}
await saveReviewState(project, state);
await appendJsonLine(path.join(project, ".product-manual", "evidence-log.jsonl"), { type: "review-mode", recordedAt: isoNow(), previousMode, mode });
process.stdout.write(`${JSON.stringify({ previousMode, mode, summary: pendingReviewSummary(state) }, null, 2)}\n`);
