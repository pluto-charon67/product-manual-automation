#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, readJson, requireArg, resolveInside, writeJsonAtomic } from "./lib/common.mjs";
import { approveCapture, loadReviewState, pendingReviewSummary, saveReviewState, updateReviewObject } from "./lib/review-state.mjs";

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const port = Number(args.port ?? 4319);
const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui/review");

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function serveFile(response, target, type) {
  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  response.end(await fs.readFile(target));
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/state") return sendJson(response, 200, await loadReviewState(project));
    if (request.method === "GET" && url.pathname === "/api/summary") return sendJson(response, 200, pendingReviewSummary(await loadReviewState(project)));
    if (request.method === "GET" && url.pathname === "/api/privacy") return sendJson(response, 200, await readJson(path.join(project, ".product-manual", "config", "privacy-policy.json")));
    if (request.method === "GET" && url.pathname === "/asset") {
      const asset = resolveInside(project, url.searchParams.get("path") ?? "");
      const extension = path.extname(asset).toLowerCase();
      const type = extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "application/octet-stream";
      return serveFile(response, asset, type);
    }
    if (request.method === "POST" && url.pathname === "/api/object") {
      const body = await readBody(request);
      const state = await loadReviewState(project);
      const result = updateReviewObject(state, body);
      await saveReviewState(project, state);
      return sendJson(response, 200, result);
    }
    if (request.method === "POST" && url.pathname === "/api/capture/approve") {
      const body = await readBody(request);
      const state = await loadReviewState(project);
      const capture = approveCapture(state, body.captureId);
      await saveReviewState(project, state);
      return sendJson(response, 200, capture);
    }
    if (request.method === "POST" && url.pathname === "/api/mode") {
      const body = await readBody(request);
      if (!["all", "risky", "none"].includes(body.mode)) return sendJson(response, 400, { error: "Invalid review mode" });
      const state = await loadReviewState(project);
      state.mode = body.mode;
      await saveReviewState(project, state);
      return sendJson(response, 200, state);
    }
    if (request.method === "POST" && url.pathname === "/api/privacy") {
      const body = await readBody(request);
      if (!body || typeof body !== "object") return sendJson(response, 400, { error: "Privacy policy must be an object" });
      body.revision = Number(body.revision ?? 0) + 1;
      body.status = "confirmed";
      body.confirmedAt = new Date().toISOString();
      await writeJsonAtomic(path.join(project, ".product-manual", "config", "privacy-policy.json"), body);
      return sendJson(response, 200, body);
    }
    const staticMap = { "/": ["index.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/styles.css": ["styles.css", "text/css; charset=utf-8"] };
    if (request.method === "GET" && staticMap[url.pathname]) {
      const [file, type] = staticMap[url.pathname];
      return serveFile(response, path.join(uiRoot, file), type);
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Product manual review workbench: http://127.0.0.1:${port}\n`);
  process.stdout.write(`Project: ${project}\n`);
});
