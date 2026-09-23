import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("MCP server exposes review and read-only database tools", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "product-manual-mcp-test-"));
  const databasePath = path.join(temporary, "demo.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec("CREATE TABLE projects (id INTEGER PRIMARY KEY, status TEXT, customer_name TEXT); INSERT INTO projects(status, customer_name) VALUES ('active', 'Sensitive Name');");
  database.close();
  const profilesPath = path.join(temporary, "profiles.json");
  await fs.writeFile(profilesPath, JSON.stringify({ profiles: [
    { id: "test-sqlite", engine: "sqlite", filename: databasePath, maxRows: 10, environment: "test" },
    { id: "prod-sqlite", engine: "sqlite", filename: databasePath, maxRows: 10, environment: "production" }
  ] }));

  const client = new Client({ name: "product-manual-test", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(pluginRoot, "mcp-server", "index.mjs")] });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((tool) => tool.name));
    for (const name of ["database_list_profiles", "database_test_connection", "database_inspect_schema", "database_execute_readonly_query", "review_get_queue", "review_update_object"]) assert.ok(names.has(name), `missing tool ${name}`);

    const profiles = await client.callTool({ name: "database_list_profiles", arguments: { profilesFile: profilesPath } });
    assert.match(profiles.content[0].text, /test-sqlite/);
    const query = await client.callTool({ name: "database_execute_readonly_query", arguments: { profilesFile: profilesPath, profileId: "test-sqlite", sql: "SELECT id, status, customer_name FROM projects", purpose: "Select representative active project" } });
    const payload = JSON.parse(query.content[0].text);
    assert.equal(payload.rows[0].status, "active");
    assert.equal(payload.rows[0].customer_name, "<redacted:customer_name>");

    const rejected = await client.callTool({ name: "database_execute_readonly_query", arguments: { profilesFile: profilesPath, profileId: "test-sqlite", sql: "DELETE FROM projects", purpose: "This must be rejected" } });
    assert.equal(rejected.isError, true);
    const productionRejected = await client.callTool({ name: "database_test_connection", arguments: { profilesFile: profilesPath, profileId: "prod-sqlite" } });
    assert.equal(productionRejected.isError, true);
  } finally {
    await client.close();
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
