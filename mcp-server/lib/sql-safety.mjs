const forbiddenTokens = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|UPSERT|CALL|EXECUTE?|GRANT|REVOKE|COPY|ATTACH|DETACH|VACUUM|ANALYZE|LOAD|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i;
const allowedStart = /^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN|PRAGMA)\b/i;

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n\r]*/g, " ").trim();
}

export function assertReadonlySql(sql) {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("SQL must be a non-empty string");
  const normalized = stripComments(sql).replace(/;+\s*$/, "").trim();
  if (!allowedStart.test(normalized)) throw new Error("Only read-only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN/PRAGMA statements are allowed");
  if (forbiddenTokens.test(normalized)) throw new Error("SQL contains a forbidden mutating or administrative token");
  if (normalized.includes(";")) throw new Error("Multiple SQL statements are not allowed");
  return normalized;
}

export function assertIdentifier(value, label = "identifier") {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_$.-]*$/.test(value)) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}
