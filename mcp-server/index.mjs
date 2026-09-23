#!/usr/bin/env node
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { appendJsonLine, isoNow, readJson, writeJsonAtomic } from "../scripts/lib/common.mjs";
import { approveCapture, loadReviewState, pendingReviewSummary, saveReviewState, updateReviewObject } from "../scripts/lib/review-state.mjs";
import { executeReadonly, inspectSchema, testConnection } from "./lib/database.mjs";
import { assertEnvironmentAccess, loadProfiles, publicProfile, resolveProfile } from "./lib/profiles.mjs";

const server = new McpServer({ name: "product-manual", version: "0.1.0" });
const profileLocationSchema = {
  projectRoot: z.string().optional().describe("Absolute product project root containing .product-manual/config/database-profiles.json"),
  profilesFile: z.string().optional().describe("Optional absolute database profiles JSON file")
};

function result(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

server.registerTool("database_list_profiles", {
  description: "List configured read-only database profiles without exposing credentials.",
  inputSchema: profileLocationSchema
}, async (input) => result({ profiles: (await loadProfiles(input)).map(publicProfile) }));

server.registerTool("database_test_connection", {
  description: "Test one configured database profile with a read-only SELECT 1 query.",
  inputSchema: { ...profileLocationSchema, profileId: z.string(), productionReadApproved: z.boolean().optional() }
}, async (input) => {
  const profile = resolveProfile(await loadProfiles(input), input.profileId);
  assertEnvironmentAccess(profile, input.productionReadApproved);
  return result({ profile: publicProfile(profile), ...(await testConnection(profile)) });
});

server.registerTool("database_inspect_schema", {
  description: "Inspect table and column metadata through a configured read-only database profile.",
  inputSchema: { ...profileLocationSchema, profileId: z.string(), tables: z.array(z.string()).max(100).optional(), productionReadApproved: z.boolean().optional() }
}, async (input) => {
  const profile = resolveProfile(await loadProfiles(input), input.profileId);
  assertEnvironmentAccess(profile, input.productionReadApproved);
  return result({ profileId: input.profileId, tables: await inspectSchema(profile, input.tables ?? []) });
});

server.registerTool("database_execute_readonly_query", {
  description: "Execute one bounded read-only SQL statement. Mutating, administrative, multi-statement, and file-access SQL is rejected. Common sensitive columns are redacted by default.",
  inputSchema: {
    ...profileLocationSchema,
    profileId: z.string(),
    sql: z.string(),
    params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    maxRows: z.number().int().min(1).max(1000).optional(),
    purpose: z.string().min(1).describe("Concrete manual evidence question this query answers"),
    productionReadApproved: z.boolean().optional().describe("Set true only after the user explicitly approves read-only access to a production-like profile")
  }
}, async (input) => {
  const profile = resolveProfile(await loadProfiles(input), input.profileId);
  assertEnvironmentAccess(profile, input.productionReadApproved);
  const queryResult = await executeReadonly(profile, input.sql, input.params ?? [], input.maxRows);
  return result({ profileId: input.profileId, purpose: input.purpose, ...queryResult });
});

server.registerTool("database_record_evidence", {
  description: "Append a sanitized database evidence summary to a product-manual workspace. Do not include SQL credentials or raw personal values.",
  inputSchema: {
    projectRoot: z.string(),
    profileId: z.string(),
    operationIds: z.array(z.string()).default([]),
    capabilityIds: z.array(z.string()).default([]),
    purpose: z.string(),
    summary: z.string(),
    objects: z.array(z.string()).default([]),
    queryHash: z.string().optional()
  }
}, async (input) => {
  const project = path.resolve(input.projectRoot);
  const target = path.join(project, ".product-manual", "database-evidence.json");
  const payload = await readJson(target, { schemaVersion: 1, events: [] });
  const event = { id: `DBE-${Date.now()}`, recordedAt: isoNow(), profileId: input.profileId, operationIds: input.operationIds, capabilityIds: input.capabilityIds, purpose: input.purpose, summary: input.summary, objects: input.objects, queryHash: input.queryHash ?? null };
  payload.events.push(event);
  await writeJsonAtomic(target, payload);
  await appendJsonLine(path.join(project, ".product-manual", "evidence-log.jsonl"), { type: "database-evidence", ...event });
  return result(event);
});

server.registerTool("review_get_queue", {
  description: "Return the pending screenshot, annotation, and redaction review queue for a product-manual project.",
  inputSchema: { projectRoot: z.string() }
}, async ({ projectRoot }) => result(pendingReviewSummary(await loadReviewState(path.resolve(projectRoot)))));

server.registerTool("review_update_object", {
  description: "Update or approve one annotation or redaction object without invalidating unrelated approved objects.",
  inputSchema: {
    projectRoot: z.string(),
    captureId: z.string(),
    objectType: z.enum(["annotation", "redaction"]),
    objectId: z.string(),
    action: z.enum(["approve", "reject"]).optional(),
    patch: z.record(z.string(), z.unknown()).optional()
  }
}, async (input) => {
  const project = path.resolve(input.projectRoot);
  const state = await loadReviewState(project);
  const updated = updateReviewObject(state, input);
  await saveReviewState(project, state);
  return result(updated);
});

server.registerTool("review_approve_capture", {
  description: "Approve one publication capture and every current annotation/redaction object on it.",
  inputSchema: { projectRoot: z.string(), captureId: z.string() }
}, async ({ projectRoot, captureId }) => {
  const project = path.resolve(projectRoot);
  const state = await loadReviewState(project);
  const capture = approveCapture(state, captureId);
  await saveReviewState(project, state);
  return result(capture);
});

server.registerTool("review_set_mode", {
  description: "Set project screenshot review mode to all, risky, or none. The default is all.",
  inputSchema: { projectRoot: z.string(), mode: z.enum(["all", "risky", "none"]) }
}, async ({ projectRoot, mode }) => {
  const project = path.resolve(projectRoot);
  const state = await loadReviewState(project);
  state.mode = mode;
  await saveReviewState(project, state);
  return result({ mode, summary: pendingReviewSummary(state) });
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("product-manual MCP server running on stdio");
