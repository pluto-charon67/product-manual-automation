#!/usr/bin/env node
import path from "node:path";
import { assertUnique, isoNow, parseArgs, readJson, requireArg, stableId, writeJsonAtomic } from "./lib/common.mjs";

const args = parseArgs();
const scanPaths = String(requireArg(args, "scans")).split(",").map((value) => path.resolve(value.trim()));
const output = path.resolve(requireArg(args, "output"));
const moduleName = String(args.module ?? "Unassigned");
const inventories = [];
for (const scanPath of scanPaths) inventories.push(await readJson(scanPath));
const backendPath = args.backend ? path.resolve(args.backend) : null;
const backend = backendPath ? await readJson(backendPath) : null;

const moduleId = stableId("MOD", moduleName);
const capabilities = [];
for (const inventory of inventories) {
  for (const affordance of inventory.affordances ?? []) {
    const label = affordance.label ?? affordance.handler ?? "Unresolved action";
    capabilities.push({
      id: stableId("CAP", inventory.platform, affordance.id),
      moduleId,
      platform: inventory.platform,
      label,
      sourceRef: affordance.file,
      affordanceId: affordance.id,
      disposition: "unresolved",
      discovery: "discovered",
      documentation: "unplanned",
      evidence: ["source"],
      execution: "not-run",
      publication: "draft"
    });
  }
}
assertUnique(capabilities, "id", "Capability ID");
const frontendApis = inventories.flatMap((inventory) => inventory.apiCandidates ?? []);
const backendEndpoints = backend?.endpoints ?? [];
const traceLinks = [];
for (const api of frontendApis) {
  const normalizedApi = String(api.path ?? "").replace(/\?.*$/, "").replace(/:\w+/g, "{}");
  for (const endpoint of backendEndpoints) {
    const normalizedEndpoint = String(endpoint.path ?? "").replace(/:\w+|\{[^}]+\}/g, "{}");
    if (normalizedApi && normalizedEndpoint && (normalizedApi === normalizedEndpoint || normalizedApi.endsWith(normalizedEndpoint) || normalizedEndpoint.endsWith(normalizedApi))) {
      traceLinks.push({ id: stableId("TRACE", api.id, endpoint.id), apiCandidateId: api.id, endpointId: endpoint.id, evidence: "source", status: "candidate" });
    }
  }
}
const graph = {
  schemaVersion: 1,
  generatedAt: isoNow(),
  scopeRevision: Number(args["scope-revision"] ?? 1),
  modules: [{ id: moduleId, name: moduleName, order: 0 }],
  businessNodes: [],
  capabilities,
  operations: [],
  traceLinks,
  backendEvidence: backend ? {
    endpoints: backend.endpoints ?? [],
    errorCandidates: backend.errorCandidates ?? [],
    validationCandidates: backend.validationCandidates ?? [],
    stateTransitionCandidates: backend.stateTransitionCandidates ?? []
  } : null,
  unresolved: capabilities.map((item) => item.id)
};
await writeJsonAtomic(output, graph);
process.stdout.write(`${JSON.stringify(graph, null, 2)}\n`);
