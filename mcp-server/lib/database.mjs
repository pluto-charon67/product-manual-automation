import path from "node:path";
import { assertIdentifier, assertReadonlySql } from "./sql-safety.mjs";

const sensitiveColumn = /(password|passwd|secret|token|cookie|authorization|credential|id_?card|identity|mobile|phone|email|address|bank|account_?no|card_?no|real_?name|full_?name|customer_?name|contact_?name|user_?name|person_?name)/i;

function sanitizeRows(rows, profile) {
  if (profile.allowSensitiveColumns === true) return rows;
  const extra = new Set((profile.sensitiveColumns ?? []).map((value) => String(value).toLowerCase()));
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sensitiveColumn.test(key) || extra.has(key.toLowerCase()) ? `<redacted:${key}>` : normalizeValue(value)])));
}

function normalizeValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return `<binary:${value.length}>`;
  if (value instanceof Date) return value.toISOString();
  return value;
}

async function withMysql(profile, action) {
  const mysql = await import("mysql2/promise");
  const connection = await mysql.createConnection({ host: profile.host, port: profile.port ?? 3306, user: profile.user, password: profile.password, database: profile.database, ssl: profile.ssl });
  try {
    try { await connection.query(`SET SESSION MAX_EXECUTION_TIME=${Math.max(100, Number(profile.timeoutMs ?? 10_000))}`); } catch { /* MariaDB and older MySQL may not support it. */ }
    return await action(connection);
  } finally {
    await connection.end();
  }
}

async function withPostgres(profile, action) {
  const { Client } = await import("pg");
  const client = new Client({ host: profile.host, port: profile.port ?? 5432, user: profile.user, password: profile.password, database: profile.database, ssl: profile.ssl });
  await client.connect();
  try {
    await client.query(`SET statement_timeout TO ${Math.max(100, Number(profile.timeoutMs ?? 10_000))}`);
    await client.query("SET default_transaction_read_only TO on");
    return await action(client);
  } finally {
    await client.end();
  }
}

async function withSqlite(profile, action) {
  const { DatabaseSync } = await import("node:sqlite");
  const filename = path.resolve(profile.filename);
  const database = new DatabaseSync(filename, { readOnly: true });
  try { return await action(database); } finally { database.close(); }
}

export async function testConnection(profile) {
  if (profile.engine === "mysql") return withMysql(profile, async (connection) => { await connection.query("SELECT 1 AS ok"); return { ok: true }; });
  if (profile.engine === "postgres") return withPostgres(profile, async (client) => { await client.query("SELECT 1 AS ok"); return { ok: true }; });
  return withSqlite(profile, async (database) => ({ ok: database.prepare("SELECT 1 AS ok").get().ok === 1 }));
}

export async function executeReadonly(profile, sql, params = [], requestedLimit) {
  const statement = assertReadonlySql(sql);
  const maxRows = Math.max(1, Math.min(Number(requestedLimit ?? profile.maxRows ?? 100), Number(profile.maxRows ?? 1000)));
  let rows;
  if (profile.engine === "mysql") rows = await withMysql(profile, async (connection) => (await connection.execute(statement, params))[0]);
  else if (profile.engine === "postgres") rows = await withPostgres(profile, async (client) => (await client.query(statement, params)).rows);
  else rows = await withSqlite(profile, async (database) => database.prepare(statement).all(...params));
  const array = Array.isArray(rows) ? rows : [];
  return { rows: sanitizeRows(array.slice(0, maxRows), profile), returnedRows: Math.min(array.length, maxRows), truncated: array.length > maxRows, maxRows };
}

export async function inspectSchema(profile, tables = []) {
  const selected = tables.map((table) => assertIdentifier(table, "table name"));
  if (profile.engine === "mysql") {
    return withMysql(profile, async (connection) => {
      const [tableRows] = selected.length ? [selected.map((name) => ({ name }))] : await connection.query("SHOW TABLES");
      const names = selected.length ? selected : tableRows.map((row) => Object.values(row)[0]).slice(0, 100);
      const result = [];
      for (const name of names) result.push({ name, columns: (await connection.query(`DESCRIBE \`${name.replaceAll("`", "``")}\``))[0].map((column) => ({ name: column.Field, type: column.Type, nullable: column.Null === "YES", key: column.Key })) });
      return result;
    });
  }
  if (profile.engine === "postgres") {
    return withPostgres(profile, async (client) => {
      const params = [];
      let filter = "";
      if (selected.length) { params.push(selected); filter = "AND table_name = ANY($1)"; }
      const rows = (await client.query(`SELECT table_schema, table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ${filter} ORDER BY table_schema, table_name, ordinal_position LIMIT 5000`, params)).rows;
      const grouped = new Map();
      for (const row of rows) {
        const key = `${row.table_schema}.${row.table_name}`;
        if (!grouped.has(key)) grouped.set(key, { name: key, columns: [] });
        grouped.get(key).columns.push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable === "YES" });
      }
      return [...grouped.values()];
    });
  }
  return withSqlite(profile, async (database) => {
    const names = selected.length ? selected : database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 100").all().map((row) => row.name);
    return names.map((name) => ({ name, columns: database.prepare(`PRAGMA table_info(\"${name.replaceAll('"', '""')}\")`).all().map((column) => ({ name: column.name, type: column.type, nullable: column.notnull === 0, key: column.pk ? "PRIMARY" : "" })) }));
  });
}
