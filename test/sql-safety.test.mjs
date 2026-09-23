import test from "node:test";
import assert from "node:assert/strict";
import { assertReadonlySql } from "../mcp-server/lib/sql-safety.mjs";

test("allows bounded read-only statement families", () => {
  assert.equal(assertReadonlySql("SELECT id, status FROM orders WHERE id = ?;"), "SELECT id, status FROM orders WHERE id = ?");
  assert.equal(assertReadonlySql("WITH selected AS (SELECT id FROM items) SELECT * FROM selected"), "WITH selected AS (SELECT id FROM items) SELECT * FROM selected");
  assert.equal(assertReadonlySql("EXPLAIN SELECT * FROM items"), "EXPLAIN SELECT * FROM items");
});

test("rejects writes, administrative operations, and multiple statements", () => {
  for (const sql of [
    "UPDATE items SET status = 1",
    "WITH changed AS (DELETE FROM items RETURNING *) SELECT * FROM changed",
    "SELECT 1; DROP TABLE items",
    "ATTACH DATABASE '/tmp/other.db' AS other",
  ]) assert.throws(() => assertReadonlySql(sql));
});
