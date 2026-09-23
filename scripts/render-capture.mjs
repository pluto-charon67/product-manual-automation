#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ensureDir, parseArgs, readJson, relativePortable, requireArg, resolveInside, sha256File, writeJsonAtomic } from "./lib/common.mjs";
import { findCapture, loadReviewState, saveReviewState } from "./lib/review-state.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const captureId = requireArg(args, "capture-id");
const state = await loadReviewState(project);
const capture = findCapture(state, captureId);
const visual = await readJson(path.join(project, ".product-manual", "config", "visual-policy.json"));
const rawPath = resolveInside(project, capture.rawPath);
const rawMeta = await sharp(rawPath).metadata();
const width = rawMeta.width;
const height = rawMeta.height;
if (!width || !height) throw new Error(`Unable to read image dimensions: ${rawPath}`);

const redactedPath = resolveInside(project, capture.redactedPath ?? `.product-manual/images/redacted/${captureId}.png`);
const annotatedPath = resolveInside(project, capture.annotatedPath ?? `.product-manual/images/annotated/${captureId}.png`);
await ensureDir(path.dirname(redactedPath));
await ensureDir(path.dirname(annotatedPath));

let pipeline = sharp(rawPath).png();
const composites = [];
for (const redaction of capture.redactions ?? []) {
  const geometry = redaction.geometry;
  if (!geometry) continue;
  const left = Math.max(0, Math.round(geometry.x));
  const top = Math.max(0, Math.round(geometry.y));
  const regionWidth = Math.max(1, Math.min(width - left, Math.round(geometry.width)));
  const regionHeight = Math.max(1, Math.min(height - top, Math.round(geometry.height)));
  if (redaction.action === "blur" || redaction.action === "pixelate") {
    let region = sharp(rawPath).extract({ left, top, width: regionWidth, height: regionHeight });
    if (redaction.action === "blur") region = region.blur(Math.max(4, Number(redaction.strength ?? 14)));
    else {
      const smallWidth = Math.max(1, Math.round(regionWidth / 12));
      const smallHeight = Math.max(1, Math.round(regionHeight / 12));
      region = region.resize(smallWidth, smallHeight).resize(regionWidth, regionHeight, { kernel: "nearest" });
    }
    composites.push({ input: await region.png().toBuffer(), left, top });
  } else {
    const color = redaction.color ?? "#1f2937";
    const svg = `<svg width="${regionWidth}" height="${regionHeight}"><rect width="100%" height="100%" rx="3" fill="${color}"/></svg>`;
    composites.push({ input: Buffer.from(svg), left, top });
  }
}
if (composites.length) pipeline = pipeline.composite(composites);
await pipeline.toFile(redactedPath);

const annotationSvg = [];
if (visual.annotationEnabled !== false) {
  const color = visual.color ?? "#ff1f0f";
  const lineWidth = Number(visual.lineWidth ?? 5);
  const radius = Number(visual.numberRadius ?? 18);
  for (const annotation of capture.annotations ?? []) {
    if (annotation.hidden) continue;
    const target = annotation.target ?? annotation.geometry;
    if (!target) continue;
    const targetX = Math.round(target.x + target.width / 2);
    const targetY = Math.round(target.y + target.height / 2);
    const labelX = Math.round(annotation.labelPoint?.x ?? Math.max(radius + 4, target.x - 56));
    const labelY = Math.round(annotation.labelPoint?.y ?? Math.max(radius + 4, target.y - 42));
    const number = Number(annotation.number ?? 1);
    annotationSvg.push(`<rect x="${Math.round(target.x)}" y="${Math.round(target.y)}" width="${Math.round(target.width)}" height="${Math.round(target.height)}" fill="none" stroke="${color}" stroke-width="${Math.max(2, lineWidth - 2)}" rx="4"/>`);
    annotationSvg.push(`<line x1="${labelX}" y1="${labelY}" x2="${targetX}" y2="${targetY}" stroke="${color}" stroke-width="${lineWidth}" marker-end="url(#arrow)"/>`);
    annotationSvg.push(`<circle cx="${labelX}" cy="${labelY}" r="${radius}" fill="${color}"/>`);
    annotationSvg.push(`<text x="${labelX}" y="${labelY + 7}" text-anchor="middle" font-family="Arial,'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif" font-size="${Math.round(radius * 1.1)}" font-weight="700" fill="#fff">${number}</text>`);
  }
}
const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="${visual.color ?? "#ff1f0f"}"/></marker></defs>${annotationSvg.join("")}</svg>`;
await sharp(redactedPath).composite([{ input: Buffer.from(overlay), left: 0, top: 0 }]).png().toFile(annotatedPath);

capture.imagePath = relativePortable(project, annotatedPath);
capture.redactedPath = relativePortable(project, redactedPath);
capture.annotatedPath = relativePortable(project, annotatedPath);
capture.rawHash = await sha256File(rawPath);
capture.derivedStatus = "current";
capture.dimensions = { width, height };

const sidecarRoot = path.join(project, ".product-manual", "images");
const annotationSidecar = path.join(sidecarRoot, "annotations", `${captureId}.json`);
const redactionSidecar = path.join(sidecarRoot, "redactions", `${captureId}.json`);
await writeJsonAtomic(annotationSidecar, { schemaVersion: 1, captureId, revision: capture.revision ?? 1, annotations: capture.annotations ?? [] });
await writeJsonAtomic(redactionSidecar, { schemaVersion: 1, captureId, policyRevision: capture.privacyPolicyRevision, redactions: capture.redactions ?? [] });
capture.annotationSidecar = relativePortable(project, annotationSidecar);
capture.redactionSidecar = relativePortable(project, redactionSidecar);
await saveReviewState(project, state);
process.stdout.write(`${JSON.stringify({ captureId, redactedPath, annotatedPath, annotationSidecar, redactionSidecar }, null, 2)}\n`);
