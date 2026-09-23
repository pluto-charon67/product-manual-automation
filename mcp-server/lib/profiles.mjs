import fs from "node:fs/promises";
import path from "node:path";

async function readProfileFile(target) {
  if (!target) return [];
  const payload = JSON.parse(await fs.readFile(path.resolve(target), "utf8"));
  return Array.isArray(payload) ? payload : payload.profiles ?? [];
}

function envProfiles() {
  if (!process.env.PRODUCT_MANUAL_DB_PROFILES) return [];
  const payload = JSON.parse(process.env.PRODUCT_MANUAL_DB_PROFILES);
  return Array.isArray(payload) ? payload : payload.profiles ?? [];
}

export async function loadProfiles({ projectRoot, profilesFile } = {}) {
  const candidates = [];
  const explicitFile = profilesFile ?? process.env.PRODUCT_MANUAL_DB_PROFILES_FILE;
  if (explicitFile) candidates.push(...await readProfileFile(explicitFile));
  if (projectRoot) {
    const projectFile = path.join(path.resolve(projectRoot), ".product-manual", "config", "database-profiles.json");
    try { candidates.push(...await readProfileFile(projectFile)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  candidates.push(...envProfiles());
  const profiles = [...new Map(candidates.map((profile) => [profile.id, validateProfile(profile)])).values()];
  return profiles;
}

function validateProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("Database profile must be an object");
  if (!profile.id || typeof profile.id !== "string") throw new Error("Database profile id is required");
  if (!["mysql", "postgres", "sqlite"].includes(profile.engine)) throw new Error(`Unsupported database engine for ${profile.id}`);
  for (const forbidden of ["password", "token", "connectionString", "url"]) {
    if (profile[forbidden]) throw new Error(`Profile ${profile.id} must not store ${forbidden}; use an environment variable reference`);
  }
  if (profile.engine === "sqlite" && !profile.filename) throw new Error(`SQLite profile ${profile.id} requires filename`);
  if (profile.engine !== "sqlite" && (!profile.host || !profile.database || !profile.user)) throw new Error(`Profile ${profile.id} requires host, database, and user`);
  return { maxRows: 100, timeoutMs: 10_000, ...profile };
}

export function publicProfile(profile) {
  const productionLike = isProductionLike(profile);
  return {
    id: profile.id,
    engine: profile.engine,
    host: profile.engine === "sqlite" ? undefined : profile.host,
    port: profile.port,
    database: profile.database,
    filename: profile.engine === "sqlite" ? profile.filename : undefined,
    environment: profile.environment ?? null,
    productionLike,
    readOnly: true,
    passwordConfigured: profile.engine === "sqlite" || Boolean(profile.passwordEnv && process.env[profile.passwordEnv]),
    maxRows: profile.maxRows,
    timeoutMs: profile.timeoutMs
  };
}

export function isProductionLike(profile) {
  if (profile.productionLike === true) return true;
  const text = [profile.id, profile.environment, profile.host, profile.database, profile.filename].filter(Boolean).join(" ");
  return /(^|[-_.\s])(prod|production|online|live)([-_.\s]|$)/i.test(text);
}

export function assertEnvironmentAccess(profile, approved) {
  if (isProductionLike(profile) && approved !== true) {
    throw new Error(`Profile ${profile.id} appears production-like. Re-run only after explicit user approval and set productionReadApproved=true.`);
  }
}

export function resolveProfile(profiles, id) {
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown database profile: ${id}`);
  const password = profile.passwordEnv ? process.env[profile.passwordEnv] : undefined;
  if (profile.engine !== "sqlite" && profile.passwordEnv && password === undefined) throw new Error(`Environment variable ${profile.passwordEnv} is not set for profile ${id}`);
  return { ...profile, password };
}
