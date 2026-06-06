import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import path from "node:path";

export const repoRoot = new URL("..", import.meta.url).pathname;

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${stableStringify(value)}\n`, "utf8");
}

export async function listJsonFiles(dirPath) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function listJsonFilesRecursive(dirPath) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFilesRecursive(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export async function loadProviders() {
  const files = await listJsonFiles(path.join(repoRoot, "registry/providers"));
  return Promise.all(files.map(readJson));
}

export async function loadSubnets() {
  const files = await listJsonFilesRecursive(path.join(repoRoot, "registry/subnets"));
  const subnets = await Promise.all(files.map(readJson));
  return subnets.sort((a, b) => a.netuid - b.netuid || a.slug.localeCompare(b.slug));
}

export async function loadNativeSnapshot() {
  return readJson(path.join(repoRoot, "registry/native/finney-subnets.json"));
}

export async function loadCandidates() {
  const files = await listJsonFilesRecursive(path.join(repoRoot, "registry/candidates"));
  const documents = await Promise.all(files.map(readJson));
  const candidates = documents.flatMap((document) => {
    if (Array.isArray(document.candidates)) {
      return document.candidates;
    }
    return [document];
  });
  return candidates.sort((a, b) => a.netuid - b.netuid || a.id.localeCompare(b.id));
}

export async function loadVerification() {
  try {
    return await readJson(path.join(repoRoot, "registry/verification/latest.json"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schema_version: 1,
        generated_at: null,
        results: []
      };
    }
    throw error;
  }
}

export function flattenSurfaces(subnets) {
  return subnets
    .flatMap((subnet) =>
      subnet.surfaces.map((surface) => ({
        ...surface,
        netuid: subnet.netuid,
        subnet_slug: subnet.slug,
        subnet_name: subnet.name
      }))
    )
    .sort((a, b) => a.netuid - b.netuid || a.id.localeCompare(b.id));
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2);
}

export function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortValue(nested)])
    );
  }

  return value;
}

export function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return ["https:", "http:", "wss:", "ws:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isUnsafeUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
      return true;
    }

    const host = url.hostname.toLowerCase();
    const literalIp = isIP(host);
    if (host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
    if (literalIp === 4) {
      return (
        host.startsWith("10.") ||
        host.startsWith("127.") ||
        host.startsWith("169.254.") ||
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      );
    }
    if (literalIp === 6) {
      return host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
    }

    return false;
  } catch {
    return true;
  }
}

export function normalizePublicUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  let candidate = value.trim().replace(/^<|>$/g, "");
  if (!candidate) {
    return null;
  }

  if (!/^(https?|wss?):\/\//i.test(candidate) && /^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol) || isUnsafeUrl(url.toString())) {
      return null;
    }
    url.hash = "";
    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value) {
  return sha256Hex(stableStringify(value));
}

export function isJsonContentType(value) {
  return String(value || "").toLowerCase().includes("json");
}

export function isHtmlContentType(value) {
  return String(value || "").toLowerCase().includes("html");
}

export function buildTimestamp() {
  return process.env.METAGRAPH_BUILD_TIMESTAMP || "1970-01-01T00:00:00.000Z";
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildRpcEndpointArtifact({ surfaces, healthSurfaces = [], generatedAt, contractVersion, source }) {
  const healthBySurface = new Map(healthSurfaces.map((surface) => [surface.surface_id, surface]));
  const endpoints = surfaces
    .filter((surface) => ["subtensor-rpc", "subtensor-wss"].includes(surface.kind))
    .map((surface) => {
      const health = healthBySurface.get(surface.id) || {};
      return {
        id: surface.id,
        netuid: surface.netuid,
        subnet_slug: surface.subnet_slug,
        subnet_name: surface.subnet_name,
        chain: "bittensor",
        network: "finney",
        kind: surface.kind,
        url: surface.url,
        provider: surface.provider,
        authority: surface.authority,
        auth_required: surface.auth_required,
        public_safe: surface.public_safe,
        archive_support: health.archive_support ?? null,
        latest_block: health.latest_block ?? null,
        methods_supported: health.methods_supported || null,
        rpc_method_count: health.rpc_method_count ?? null,
        method_tested: health.method_tested || surface.probe?.method || null,
        status: health.status || "unknown",
        classification: health.classification || "unknown",
        latency_ms: health.latency_ms ?? null,
        last_checked: health.verified_at || health.last_checked || null,
        error: health.error || null,
        rate_limit_notes: surface.rate_limit_notes || null,
        source_urls: surface.source_urls || []
      };
    })
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));

  return {
    schema_version: 1,
    contract_version: contractVersion,
    generated_at: generatedAt,
    source,
    notes: "Bittensor base-layer RPC endpoints only. These are chain-level surfaces, not subnet application APIs.",
    summary: {
      endpoint_count: endpoints.length,
      by_kind: countRecord(endpoints, (endpoint) => endpoint.kind),
      by_provider: countRecord(endpoints, (endpoint) => endpoint.provider),
      by_status: countRecord(endpoints, (endpoint) => endpoint.status),
      archive_supported_count: endpoints.filter((endpoint) => endpoint.archive_support === true).length
    },
    endpoints
  };
}

function countRecord(items, keyFn) {
  return Object.fromEntries(
    Object.entries(
      items.reduce((accumulator, item) => {
        const key = keyFn(item) || "unknown";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b))
  );
}
