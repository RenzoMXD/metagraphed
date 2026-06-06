import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = {
  subnets: "public/metagraph/subnets.json",
  surfaces: "public/metagraph/surfaces.json",
  coverage: "public/metagraph/coverage.json",
  health: "public/metagraph/health/latest.json",
  rpc: "public/metagraph/rpc-endpoints.json",
  schemaDrift: "public/metagraph/schema-drift.json",
  adaptersAllways: "public/metagraph/adapters/allways.json",
  adaptersGittensor: "public/metagraph/adapters/gittensor.json"
};

const previous = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readHeadJson(file)]));
const current = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readWorktreeJson(file)]));

const subnetDiff = diffByKey(previous.subnets?.subnets || [], current.subnets?.subnets || [], "netuid");
const surfaceDiff = diffByKey(previous.surfaces?.surfaces || [], current.surfaces?.surfaces || [], "id");
const renamed = (current.subnets?.subnets || [])
  .map((subnet) => {
    const oldSubnet = (previous.subnets?.subnets || []).find((candidate) => candidate.netuid === subnet.netuid);
    return oldSubnet && oldSubnet.name !== subnet.name
      ? `${subnet.netuid}: ${oldSubnet.name} -> ${subnet.name}`
      : null;
  })
  .filter(Boolean);

const lines = [];
lines.push("## Summary");
lines.push("- refresh Metagraphed backend registry artifacts for `metagraph.sh`");
lines.push(`- native subnets: ${countLine(previous.coverage?.chain_subnet_count, current.coverage?.chain_subnet_count)}`);
lines.push(`- curated surfaces: ${countLine(previous.coverage?.surface_count, current.coverage?.surface_count)}`);
lines.push(`- candidate surfaces: ${countLine(previous.coverage?.candidate_count, current.coverage?.candidate_count)}`);
lines.push(`- probed surfaces: ${countLine(previous.coverage?.probed_surface_count, current.coverage?.probed_surface_count)}`);
lines.push("");
lines.push("## What changed");
lines.push(`- added netuids: ${formatList(subnetDiff.added.map((subnet) => String(subnet.netuid)))}`);
lines.push(`- removed netuids: ${formatList(subnetDiff.removed.map((subnet) => String(subnet.netuid)))}`);
lines.push(`- renamed netuids: ${formatList(renamed)}`);
lines.push(`- added surfaces: ${formatList(surfaceDiff.added.map((surface) => surface.id), 12)}`);
lines.push(`- removed surfaces: ${formatList(surfaceDiff.removed.map((surface) => surface.id), 12)}`);
lines.push("");
lines.push("## Health");
lines.push(`- surface status: ${formatCounts(current.health?.summary?.status_counts)}`);
lines.push(`- surface classifications: ${formatCounts(current.health?.summary?.classification_counts)}`);
lines.push(`- RPC endpoints: ${formatCounts(current.rpc?.summary?.by_status)}`);
lines.push(`- RPC archive-supported endpoints: ${current.rpc?.summary?.archive_supported_count ?? 0}`);
lines.push("");
lines.push("## Schema And Adapters");
lines.push(`- OpenAPI drift: ${formatCounts(current.schemaDrift?.summary?.by_drift_status)}`);
lines.push(`- Allways adapter: ${current.adaptersAllways?.snapshot?.status || "not-captured"}`);
lines.push(`- Gittensor adapter: ${current.adaptersGittensor?.snapshot?.status || "not-captured"}`);
lines.push("");
lines.push("## Validation");
lines.push("- `npm run validate`");
lines.push("- `npm test`");
lines.push("- `npm run build`");
lines.push("- `npm run schemas:snapshot`");
lines.push("- `npm run adapters:snapshot`");
lines.push("- `METAGRAPH_WRITE_PROBE_RESULTS=1 npm run probes:smoke`");
lines.push("- `npm run scan:public-safety`");

console.log(lines.join("\n"));

function readWorktreeJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readHeadJson(file) {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}

function diffByKey(oldItems, newItems, key) {
  const oldMap = new Map(oldItems.map((item) => [String(item[key]), item]));
  const newMap = new Map(newItems.map((item) => [String(item[key]), item]));
  return {
    added: [...newMap.entries()].filter(([id]) => !oldMap.has(id)).map(([, item]) => item),
    removed: [...oldMap.entries()].filter(([id]) => !newMap.has(id)).map(([, item]) => item)
  };
}

function countLine(oldValue, newValue) {
  const oldCount = Number.isFinite(oldValue) ? oldValue : "n/a";
  const newCount = Number.isFinite(newValue) ? newValue : "n/a";
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) {
    return `${newCount} (previous ${oldCount})`;
  }
  const delta = newValue - oldValue;
  return `${newValue} (${delta >= 0 ? "+" : ""}${delta})`;
}

function formatList(items, limit = 20) {
  if (!items.length) {
    return "none";
  }
  const shown = items.slice(0, limit);
  const suffix = items.length > shown.length ? `, +${items.length - shown.length} more` : "";
  return `${shown.join(", ")}${suffix}`;
}

function formatCounts(counts) {
  if (!counts || Object.keys(counts).length === 0) {
    return "none";
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}
