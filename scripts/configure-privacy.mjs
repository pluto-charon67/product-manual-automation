#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { appendJsonLine, isoNow, parseArgs, readJson, requireArg, writeJsonAtomic } from "./lib/common.mjs";
import { loadReviewState, saveReviewState } from "./lib/review-state.mjs";

const allowedActions = new Set(["solid-mask", "partial-mask", "blur", "pixelate", "replace-text", "exclude-capture"]);

function validatePolicy(policy) {
  if (!policy || typeof policy !== "object") throw new Error("Privacy policy must be an object");
  if (!Array.isArray(policy.categories) || !Array.isArray(policy.rules)) throw new Error("Privacy policy requires categories and rules arrays");
  const ids = new Set();
  for (const category of policy.categories) {
    if (!category.id || ids.has(category.id)) throw new Error(`Duplicate or missing privacy category id: ${category.id}`);
    ids.add(category.id);
    if (!allowedActions.has(category.action)) throw new Error(`Unsupported category action: ${category.action}`);
  }
  for (const rule of policy.rules) {
    if (!rule.id || ids.has(rule.id)) throw new Error(`Duplicate or missing privacy rule id: ${rule.id}`);
    ids.add(rule.id);
    if (rule.action && !allowedActions.has(rule.action)) throw new Error(`Unsupported rule action: ${rule.action}`);
    if (Object.values(rule).some((value) => typeof value === "string" && /password|token|cookie|authorization/i.test(value))) throw new Error(`Rule ${rule.id} appears to contain secret-bearing content`);
  }
}

function changedIds(before, after, key) {
  const beforeMap = new Map((before[key] ?? []).map((item) => [item.id, JSON.stringify(item)]));
  const afterMap = new Map((after[key] ?? []).map((item) => [item.id, JSON.stringify(item)]));
  return new Set([...new Set([...beforeMap.keys(), ...afterMap.keys()])].filter((id) => beforeMap.get(id) !== afterMap.get(id)));
}

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const proposedPath = path.resolve(requireArg(args, "policy"));
const target = path.join(project, ".product-manual", "config", "privacy-policy.json");
const before = await readJson(target);
const proposed = JSON.parse(await fs.readFile(proposedPath, "utf8"));
validatePolicy(proposed);

const categoryChanges = changedIds(before, proposed, "categories");
const ruleChanges = changedIds(before, proposed, "rules");
const globalChange = before.defaultAction !== proposed.defaultAction || before.preserveFunctionalControls !== proposed.preserveFunctionalControls || JSON.stringify(before.protectedElements ?? []) !== JSON.stringify(proposed.protectedElements ?? []);
proposed.schemaVersion = 1;
proposed.revision = Number(before.revision ?? 0) + 1;
proposed.status = args.confirm ? "confirmed" : "pending";
proposed.confirmedAt = args.confirm ? isoNow() : null;
proposed.confirmedBy = args.confirm ? String(args["confirmed-by"] ?? "user") : null;
await writeJsonAtomic(target, proposed);

const reviewState = await loadReviewState(project);
let invalidated = 0;
for (const capture of reviewState.captures ?? []) {
  let captureChanged = false;
  for (const redaction of capture.redactions ?? []) {
    if (globalChange || categoryChanges.has(redaction.category) || ruleChanges.has(redaction.ruleId)) {
      redaction.status = "pending";
      redaction.revision = Number(redaction.revision ?? 1) + 1;
      redaction.reviewedAt = null;
      captureChanged = true;
      invalidated += 1;
    }
  }
  if (captureChanged) {
    capture.status = "pending";
    capture.derivedStatus = "stale";
    capture.privacyPolicyRevision = proposed.revision;
  }
}
await saveReviewState(project, reviewState);
await appendJsonLine(path.join(project, ".product-manual", "evidence-log.jsonl"), {
  type: "privacy-policy",
  recordedAt: isoNow(),
  revision: proposed.revision,
  status: proposed.status,
  changedCategories: [...categoryChanges],
  changedRules: [...ruleChanges],
  globalChange,
  invalidatedRedactions: invalidated
});
process.stdout.write(`${JSON.stringify({ target, revision: proposed.revision, status: proposed.status, changedCategories: [...categoryChanges], changedRules: [...ruleChanges], globalChange, invalidatedRedactions: invalidated }, null, 2)}\n`);
