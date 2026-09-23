#!/usr/bin/env node
import path from "node:path";
import sharp from "sharp";
import { ensureDir, parseArgs, readJson, relativePortable, requireArg, resolveInside, writeJsonAtomic } from "./lib/common.mjs";
import { findCapture, loadReviewState } from "./lib/review-state.mjs";

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function wrapCaption(text, max = 20) {
  const characters = [...String(text ?? "")];
  const lines = [];
  while (characters.length) lines.push(characters.splice(0, max).join(""));
  return lines.length ? lines.slice(0, 3) : [""];
}

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const specPath = path.resolve(requireArg(args, "spec"));
const spec = await readJson(specPath);
const state = await loadReviewState(project);
const visual = await readJson(path.join(project, ".product-manual", "config", "visual-policy.json"));
const items = [];
for (const item of spec.items ?? []) {
  const capture = findCapture(state, item.captureId);
  const source = resolveInside(project, capture.annotatedPath ?? capture.imagePath ?? capture.redactedPath);
  const buffer = await sharp(source).resize({ width: Number(spec.cellWidth ?? 360), withoutEnlargement: true }).png().toBuffer();
  const metadata = await sharp(buffer).metadata();
  items.push({ ...item, capture, buffer, width: metadata.width, height: metadata.height });
}
if (!items.length) throw new Error("Sequence spec has no items");
const columns = Number(spec.columns ?? (items.length >= Number(visual.longSequenceThreshold ?? 4) ? visual.longSequenceColumns ?? 3 : Math.min(2, items.length)));
const cellWidth = Math.max(...items.map((item) => item.width));
const captionHeight = 76;
const gap = 20;
const rows = Math.ceil(items.length / columns);
const rowHeights = [];
for (let row = 0; row < rows; row += 1) rowHeights.push(Math.max(...items.slice(row * columns, row * columns + columns).map((item) => item.height + captionHeight)));
const canvasWidth = columns * cellWidth + (columns + 1) * gap;
const canvasHeight = rowHeights.reduce((sum, value) => sum + value, 0) + (rows + 1) * gap;
const composites = [];
let rowTop = gap;
for (let index = 0; index < items.length; index += 1) {
  const row = Math.floor(index / columns);
  const column = index % columns;
  if (column === 0 && row > 0) rowTop += rowHeights[row - 1] + gap;
  const item = items[index];
  const left = gap + column * (cellWidth + gap) + Math.floor((cellWidth - item.width) / 2);
  composites.push({ input: item.buffer, left, top: rowTop });
  const lines = wrapCaption(item.caption ?? item.label ?? "", Number(spec.captionCharactersPerLine ?? 20));
  const text = lines.map((line, lineIndex) => `<text x="${cellWidth / 2}" y="${26 + lineIndex * 22}" text-anchor="middle" font-family="Arial,'PingFang SC',sans-serif" font-size="16" fill="#111827">${escapeXml(line)}</text>`).join("");
  const caption = `<svg width="${cellWidth}" height="${captionHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/>${text}</svg>`;
  composites.push({ input: Buffer.from(caption), left: gap + column * (cellWidth + gap), top: rowTop + item.height });
}
const output = resolveInside(project, spec.outputPath ?? `.product-manual/images/sequences/${spec.id}.png`);
await ensureDir(path.dirname(output));
await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#f3f4f6" } }).composite(composites).png().toFile(output);
spec.renderedPath = relativePortable(project, output);
spec.columns = columns;
spec.renderedAt = new Date().toISOString();
await writeJsonAtomic(specPath, spec);
process.stdout.write(`${JSON.stringify({ id: spec.id, output, columns, items: items.length }, null, 2)}\n`);
