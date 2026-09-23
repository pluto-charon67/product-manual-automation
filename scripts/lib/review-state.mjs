import path from "node:path";
import { isoNow, readJson, writeJsonAtomic } from "./common.mjs";

export function reviewStatePath(projectRoot) {
  return path.join(projectRoot, ".product-manual", "review-state.json");
}

export async function loadReviewState(projectRoot) {
  return readJson(reviewStatePath(projectRoot), { schemaVersion: 1, mode: "all", updatedAt: isoNow(), captures: [] });
}

export async function saveReviewState(projectRoot, state) {
  state.updatedAt = isoNow();
  await writeJsonAtomic(reviewStatePath(projectRoot), state);
  return state;
}

export function findCapture(state, captureId) {
  const capture = state.captures.find((item) => item.id === captureId);
  if (!capture) throw new Error(`Unknown capture: ${captureId}`);
  return capture;
}

export function recomputeCaptureStatus(capture, mode = "all") {
  if (mode === "none") {
    capture.status = "bypassed";
    return capture.status;
  }
  const objects = [...(capture.annotations ?? []), ...(capture.redactions ?? [])];
  const required = mode === "all" ? objects : objects.filter((item) => item.requiresReview || Number(item.confidence ?? 1) < 0.9 || item.source === "vision");
  if (capture.rejectedAt || required.some((item) => item.status === "rejected")) capture.status = "rejected";
  else if (required.length && required.every((item) => item.status === "approved")) capture.status = "approved";
  else if (!required.length && capture.status === "approved") capture.status = "approved";
  else capture.status = "pending";
  return capture.status;
}

export function updateReviewObject(state, input) {
  const capture = findCapture(state, input.captureId);
  const collectionName = input.objectType === "redaction" ? "redactions" : "annotations";
  const object = (capture[collectionName] ?? []).find((item) => item.id === input.objectId);
  if (!object) throw new Error(`Unknown ${input.objectType}: ${input.objectId}`);
  const geometryChanged = input.patch && Object.keys(input.patch).some((key) => ["geometry", "target", "labelPoint", "action", "category"].includes(key));
  Object.assign(object, input.patch ?? {});
  if (geometryChanged) {
    object.revision = Number(object.revision ?? 1) + 1;
    object.status = "pending";
    object.reviewedAt = null;
    capture.revision = Number(capture.revision ?? 1) + 1;
    capture.derivedStatus = "stale";
  }
  if (input.action === "approve") {
    object.status = "approved";
    object.reviewedAt = isoNow();
  } else if (input.action === "reject") {
    object.status = "rejected";
    object.reviewedAt = isoNow();
  }
  capture.updatedAt = isoNow();
  recomputeCaptureStatus(capture, state.mode);
  return { capture, object };
}

export function approveCapture(state, captureId) {
  const capture = findCapture(state, captureId);
  for (const object of [...(capture.annotations ?? []), ...(capture.redactions ?? [])]) {
    object.status = "approved";
    object.reviewedAt = isoNow();
  }
  capture.status = "approved";
  capture.reviewedAt = isoNow();
  capture.updatedAt = isoNow();
  return capture;
}

export function pendingReviewSummary(state) {
  const captures = state.captures.filter((capture) => recomputeCaptureStatus(capture, state.mode) === "pending");
  return {
    mode: state.mode,
    totalCaptures: state.captures.length,
    pendingCaptures: captures.length,
    rejectedCaptures: state.captures.filter((capture) => capture.status === "rejected").length,
    approvedCaptures: state.captures.filter((capture) => capture.status === "approved").length,
    items: captures.map((capture) => ({
      id: capture.id,
      operationId: capture.operationId,
      platform: capture.platform,
      imagePath: capture.imagePath,
      pendingAnnotations: (capture.annotations ?? []).filter((item) => item.status !== "approved").map((item) => item.id),
      pendingRedactions: (capture.redactions ?? []).filter((item) => item.status !== "approved").map((item) => item.id)
    }))
  };
}
