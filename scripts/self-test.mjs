#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { approveCapture, loadReviewState, saveReviewState } from "./lib/review-state.mjs";
import { readJson, writeJsonAtomic } from "./lib/common.mjs";

const run = promisify(execFile);
const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "product-manual-self-test-"));
const project = path.join(temporaryRoot, "demo-web-product");

async function script(name, args) {
  const result = await run(process.execPath, [path.join(pluginRoot, "scripts", name), ...args], { cwd: pluginRoot, maxBuffer: 10 * 1024 * 1024 });
  return result.stdout;
}

try {
  await fs.mkdir(path.join(project, "src", "pages"), { recursive: true });
  await fs.writeFile(path.join(project, "package.json"), JSON.stringify({ name: "demo-web-product", dependencies: { react: "^19.0.0" } }, null, 2));
  await fs.writeFile(path.join(project, "src", "pages", "Home.tsx"), `export function Home(){return <button onClick={createProject}>新增项目</button>}\n`);
  await script("init-workspace.mjs", ["--project", project, "--platforms", "web"]);
  await script("detect-project.mjs", ["--project", project]);
  await script("scan-web.mjs", ["--project", project]);
  await script("build-capability-graph.mjs", ["--scans", path.join(project, ".product-manual", "web-inventory.json"), "--output", path.join(project, ".product-manual", "capability-graph.json"), "--module", "项目管理"]);

  const rawRelative = ".product-manual/images/raw/MOD-PROJECT/OP-PROJECT-CREATE/CAPTURE-1.png";
  const rawAbsolute = path.join(project, rawRelative);
  await fs.mkdir(path.dirname(rawAbsolute), { recursive: true });
  await sharp({ create: { width: 480, height: 320, channels: 4, background: "#f8fafc" } })
    .composite([{ input: Buffer.from(`<svg width="480" height="320"><rect x="330" y="40" width="110" height="44" rx="8" fill="#2563eb"/><text x="385" y="68" text-anchor="middle" font-family="Arial" font-size="18" fill="#fff">Add project</text><text x="40" y="170" font-family="Arial" font-size="20" fill="#111827">Customer: Test User</text></svg>`) }])
    .png().toFile(rawAbsolute);

  const reviewState = await loadReviewState(project);
  reviewState.captures.push({
    id: "CAPTURE-1",
    operationId: "OP-PROJECT-CREATE",
    platform: "web",
    rawPath: rawRelative,
    redactedPath: ".product-manual/images/redacted/CAPTURE-1.png",
    annotatedPath: ".product-manual/images/annotated/CAPTURE-1.png",
    status: "pending",
    revision: 1,
    privacyPolicyRevision: 1,
    annotations: [{ id: "ANN-1", number: 1, source: "dom-geometry", confidence: 1, revision: 1, status: "pending", target: { x: 330, y: 40, width: 110, height: 44 }, labelPoint: { x: 290, y: 30 } }],
    redactions: [{ id: "RED-1", category: "person-name", action: "solid-mask", source: "manual", confidence: 1, revision: 1, status: "pending", geometry: { x: 145, y: 148, width: 110, height: 28 } }]
  });
  approveCapture(reviewState, "CAPTURE-1");
  await saveReviewState(project, reviewState);
  await script("render-capture.mjs", ["--project", project, "--capture-id", "CAPTURE-1"]);

  const sequenceSpec = {
    schemaVersion: 1,
    id: "SEQ-PROJECT-CREATE-WEB",
    platform: "web",
    operationId: "OP-PROJECT-CREATE",
    outputPath: ".product-manual/images/sequences/OP-PROJECT-CREATE-WEB.png",
    items: [{ captureId: "CAPTURE-1", transitionId: "TR-PROJECT-CREATE-WEB-01", captureRole: "before-action", number: 1, caption: "单击新增项目" }]
  };
  const sequenceSpecPath = path.join(project, ".product-manual", "images", "sequences", "OP-PROJECT-CREATE-WEB.json");
  await writeJsonAtomic(sequenceSpecPath, sequenceSpec);
  await script("compose-sequence.mjs", ["--project", project, "--spec", sequenceSpecPath]);

  const graphPath = path.join(project, ".product-manual", "capability-graph.json");
  const graph = await readJson(graphPath);
  for (const capability of graph.capabilities) capability.disposition = "included";
  await writeJsonAtomic(graphPath, graph);
  const capabilityIds = graph.capabilities.map((item) => item.id);
  const operation = {
    schemaVersion: 1,
    id: "OP-PROJECT-CREATE",
    title: "新增项目",
    moduleId: graph.modules[0].id,
    moduleName: "项目管理",
    businessNodeId: "NODE-PROJECT-LIST",
    businessNodeName: "项目列表",
    kind: "main-flow",
    scenario: "需要创建新的项目记录时使用。",
    prerequisites: [],
    result: "项目创建成功并显示在项目列表中。",
    capabilityIds,
    manualAnchor: "op-project-create",
    businessErrors: [],
    platformVariants: {
      web: {
        id: "VAR-PROJECT-CREATE-WEB",
        entryPath: "工作台 → 项目管理 → 项目列表",
        executionTier: "C",
        executionStatus: "passed",
        transitions: [{ id: "TR-PROJECT-CREATE-WEB-01", sequence: 1, fromState: "项目列表", target: "新增项目按钮", toState: "新增项目表单", beforeCaptureId: "CAPTURE-1", afterCaptureId: "CAPTURE-1" }],
        sequenceImages: [".product-manual/images/sequences/OP-PROJECT-CREATE-WEB.png"]
      }
    },
    publication: "publishable"
  };
  const operationsRoot = path.join(project, ".product-manual-plan", "operations");
  await fs.mkdir(operationsRoot, { recursive: true });
  await writeJsonAtomic(path.join(operationsRoot, `${operation.id}.json`), operation);
  await writeJsonAtomic(path.join(project, ".product-manual", "capture-manifest.json"), { schemaVersion: 1, captures: [{ id: "CAPTURE-1", operationId: operation.id, transitionId: "TR-PROJECT-CREATE-WEB-01", role: "before-action", rawPath: rawRelative }], sequences: [{ id: sequenceSpec.id, operationId: operation.id, path: sequenceSpec.outputPath }] });

  await script("render-coverage.mjs", ["--project", project]);
  const coveragePath = path.join(project, ".product-manual", "coverage.json");
  const coverage = await readJson(coveragePath);
  for (const entry of coverage.entries) Object.assign(entry, { operationId: operation.id, manualSection: "op-project-create", execution: "passed", publication: "publishable" });
  await writeJsonAtomic(coveragePath, coverage);

  const privacyPath = path.join(project, ".product-manual", "config", "privacy-policy.json");
  const privacy = await readJson(privacyPath);
  Object.assign(privacy, { status: "confirmed", confirmedAt: new Date().toISOString(), confirmedBy: "self-test" });
  await writeJsonAtomic(privacyPath, privacy);
  const runStatePath = path.join(project, ".product-manual", "run-state.json");
  const runState = await readJson(runStatePath);
  runState.gates = { gate1: "confirmed", gate2: "confirmed", gate3: "read-only", gate4: "confirmed" };
  await writeJsonAtomic(runStatePath, runState);

  await script("render-manual.mjs", ["--project", project]);
  const validation = await run(process.execPath, [path.join(pluginRoot, "scripts", "validate-publication.mjs"), "--project", project, "--strict"], { cwd: pluginRoot });
  process.stdout.write(validation.stdout);
  process.stdout.write(`Self-test passed: ${project}\n`);
} finally {
  if (!keep) await fs.rm(temporaryRoot, { recursive: true, force: true });
  else process.stdout.write(`Self-test workspace retained: ${temporaryRoot}\n`);
}
