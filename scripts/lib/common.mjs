import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function parseArgs(argv = process.argv.slice(2)) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

export function requireArg(args, name) {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required argument --${name}`);
  }
  return value;
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

export async function readJson(target, fallback = undefined) {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    if (fallback !== undefined && error?.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJsonAtomic(target, value) {
  await ensureDir(path.dirname(target));
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, target);
}

export async function writeJsonIfMissing(target, value) {
  if (await pathExists(target)) return false;
  await writeJsonAtomic(target, value);
  return true;
}

export async function appendJsonLine(target, value) {
  await ensureDir(path.dirname(target));
  await fs.appendFile(target, `${JSON.stringify(value)}\n`, "utf8");
}

export function isoNow() {
  return new Date().toISOString();
}

export function slug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

export function stableId(prefix, ...parts) {
  const readable = parts.map(slug).filter(Boolean).join("-").toUpperCase();
  if (readable && readable.length <= 72) return `${prefix}-${readable}`;
  const hash = crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 12).toUpperCase();
  return readable ? `${prefix}-${readable.slice(0, 56)}-${hash}` : `${prefix}-${hash}`;
}

export async function sha256File(target) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(target));
  return hash.digest("hex");
}

export function resolveInside(root, candidate, pathApi = path) {
  const absoluteRoot = pathApi.resolve(root);
  const absolute = pathApi.resolve(absoluteRoot, candidate);
  const relative = pathApi.relative(absoluteRoot, absolute);
  if (relative === ".." || relative.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relative)) {
    throw new Error(`Path escapes allowed root: ${candidate}`);
  }
  return absolute;
}

export async function walkFiles(root, options = {}) {
  const ignored = new Set(options.ignore ?? [
    ".git",
    ".product-manual",
    ".product-manual-plan",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
  ]);
  const maxFiles = options.maxFiles ?? 20_000;
  const result = [];
  async function visit(directory) {
    if (result.length >= maxFiles) return;
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (result.length >= maxFiles) break;
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  await visit(path.resolve(root));
  return result;
}

export async function latestMtime(files) {
  let latest = 0;
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      latest = Math.max(latest, stat.mtimeMs);
    } catch {
      // Ignore files that disappear during a scan.
    }
  }
  return latest;
}

export async function copyJsonTemplate(name) {
  return readJson(path.join(pluginRoot, "assets", name));
}

export function relativePortable(root, target, pathApi = path) {
  return pathApi.relative(root, target).split(pathApi.sep).join("/");
}

export function assertUnique(items, field, label = field) {
  const seen = new Set();
  for (const item of items) {
    const value = item?.[field];
    if (!value) throw new Error(`${label} is required`);
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}
