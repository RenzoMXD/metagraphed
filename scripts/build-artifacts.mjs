import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildTimestamp,
  buildRpcEndpointArtifact,
  flattenSurfaces,
  listJsonFilesRecursive,
  loadCandidates,
  loadNativeSnapshot,
  loadProviders,
  loadSubnets,
  loadVerification,
  readJson,
  repoRoot,
  slugify,
  writeJson
} from "./lib.mjs";

const providers = await loadProviders();
const overlays = await loadSubnets();
const candidates = await loadCandidates();
const verification = await loadVerification();
const adapterSnapshots = await loadAdapterSnapshots();
const reviewDecisions = await loadReviewDecisions();
const nativeSnapshot = await loadNativeSnapshot();
const overlayByNetuid = new Map(overlays.map((overlay) => [overlay.netuid, overlay]));
const chainSubnets = nativeSnapshot.subnets;
const candidatesByNetuid = groupByNetuid(candidates);
const verificationByCandidate = new Map((verification.results || []).map((result) => [result.candidate_id, result]));
const mergedSubnets = chainSubnets.map((nativeSubnet) =>
  mergeSubnet(nativeSubnet, overlayByNetuid.get(nativeSubnet.netuid), candidatesByNetuid.get(nativeSubnet.netuid)?.length || 0)
);
const activeOverlayNetuids = new Set(chainSubnets.map((subnet) => subnet.netuid));
const activeOverlays = overlays.filter((overlay) => activeOverlayNetuids.has(overlay.netuid));
const surfaces = flattenSurfaces(activeOverlays);
const outputRoot = path.join(repoRoot, "public/metagraph");
const generatedAt = buildTimestamp();
const contractVersion = "2026-06-06.1";

const subnetIndex = mergedSubnets.map((subnet) => ({
  block: subnet.block,
  candidate_count: subnet.candidate_count,
  categories: subnet.categories,
  coverage_level: subnet.coverage_level,
  curation_level: subnet.curation.level,
  dashboard_url: subnet.dashboard_url,
  docs_url: subnet.docs_url,
  gap_count: subnet.gaps.missing_kinds.length,
  mechanism_count: subnet.mechanism_count,
  name: subnet.name,
  native_name: subnet.native_name,
  netuid: subnet.netuid,
  participant_count: subnet.participant_count,
  probed_surface_count: subnet.probed_surface_count,
  registered_at_block: subnet.registered_at_block,
  slug: subnet.slug,
  source_repo: subnet.source_repo,
  status: subnet.status,
  subnet_type: subnet.subnet_type,
  surface_count: subnet.surface_count,
  symbol: subnet.symbol,
  tempo: subnet.tempo,
  website_url: subnet.website_url
}));

const metagraphLatest = {
  schema_version: 1,
  generated_at: generatedAt,
  network: nativeSnapshot.network,
  source: nativeSnapshot.source,
  captured_at: nativeSnapshot.captured_at,
  notes: "Native Bittensor chain data is canonical for active subnet existence. Curated overlays add public interface metadata where verified.",
  subnets: subnetIndex
};

const healthArtifacts = buildHealthArtifacts(
  surfaces.map((surface) => ({
    auth_required: surface.auth_required,
    classification: "unknown",
    kind: surface.kind,
    last_checked: null,
    last_ok: null,
    latency_ms: null,
    method_tested: surface.probe?.method || "not-configured",
    netuid: surface.netuid,
    provider: surface.provider,
    public_safe: surface.public_safe,
    status: "unknown",
    subnet_name: surface.subnet_name,
    subnet_slug: surface.subnet_slug,
    surface_id: surface.id,
    url: surface.url,
    uptime_sample_ratio: null,
    verified_at: null
  })),
  mergedSubnets,
  {
    generatedAt,
    notes:
      "Run npm run probes:smoke with METAGRAPH_WRITE_PROBE_RESULTS=1 to replace unknown build-time health with live probe results.",
    source: "artifact-build"
  }
);
const rpcEndpoints = buildRpcEndpointArtifact({
  surfaces,
  healthSurfaces: healthArtifacts.latest.surfaces,
  generatedAt,
  contractVersion,
  source: "artifact-build"
});
const curationReview = buildCurationReview(mergedSubnets, surfaces, candidates, verification, reviewDecisions);
const schemaDriftPlaceholder = buildSchemaDriftPlaceholder(surfaces);
const contracts = buildContracts();

const adapterArtifacts = Object.fromEntries(
  activeOverlays
    .filter((subnet) => subnet.extensions)
    .map((subnet) => [
      subnet.slug,
      {
        schema_version: 1,
        generated_at: generatedAt,
        netuid: subnet.netuid,
        subnet: subnet.name,
        slug: subnet.slug,
        extensions: subnet.extensions,
        snapshot: adapterSnapshots.get(subnet.slug) || null
      }
    ])
);

const coverage = {
  schema_version: 1,
  generated_at: generatedAt,
  network: nativeSnapshot.network,
  native_snapshot_captured_at: nativeSnapshot.captured_at,
  source: {
    native: nativeSnapshot.source,
    overlays: "registry/subnets",
    candidates: "registry/candidates"
  },
  chain_subnet_count: chainSubnets.length,
  root_subnet_count: mergedSubnets.filter((subnet) => subnet.subnet_type === "root").length,
  application_subnet_count: mergedSubnets.filter((subnet) => subnet.subnet_type === "application").length,
  curated_overlay_count: activeOverlays.length,
  native_only_count: mergedSubnets.filter((subnet) => subnet.coverage_level === "native-only").length,
  manifested_count: mergedSubnets.filter((subnet) => subnet.coverage_level === "manifested").length,
  probed_count: mergedSubnets.filter((subnet) => subnet.coverage_level === "probed").length,
  surface_count: surfaces.length,
  probed_surface_count: surfaces.filter((surface) => surface.probe?.enabled).length,
  candidate_count: candidates.length,
  candidate_subnet_count: candidatesByNetuid.size,
  curation_level_counts: countBy(mergedSubnets, (subnet) => subnet.curation.level),
  native_only_with_candidates: mergedSubnets.filter(
    (subnet) => subnet.coverage_level === "native-only" && subnet.candidate_count > 0
  ).length,
  native_only_without_candidates: mergedSubnets.filter(
    (subnet) => subnet.coverage_level === "native-only" && subnet.candidate_count === 0
  ).length
};

const candidateIndex = candidates.map((candidate) => ({
  ...candidate,
  verification: verificationByCandidate.get(candidate.id) || candidate.verification || null,
  subnet_name: nativeSnapshot.subnets.find((subnet) => subnet.netuid === candidate.netuid)?.name || null
}));

const reviewQueue = candidateIndex.filter((candidate) =>
  ["schema-valid", "maintainer-review", "stale"].includes(candidate.state)
);

const curationIndex = mergedSubnets.map((subnet) => ({
  candidate_count: subnet.candidate_count,
  coverage_level: subnet.coverage_level,
  curation: subnet.curation,
  gap_count: subnet.gaps.missing_kinds.length,
  gaps: subnet.gaps,
  name: subnet.name,
  netuid: subnet.netuid,
  slug: subnet.slug,
  surface_count: subnet.surface_count
}));

const gapsIndex = mergedSubnets.map((subnet) => ({
  coverage_level: subnet.coverage_level,
  curation_level: subnet.curation.level,
  gaps: subnet.gaps,
  name: subnet.name,
  netuid: subnet.netuid,
  slug: subnet.slug
}));

await writeJson(path.join(outputRoot, "providers.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  providers
});

await writeJson(path.join(outputRoot, "subnets.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  network: nativeSnapshot.network,
  source: nativeSnapshot.source,
  native_snapshot_captured_at: nativeSnapshot.captured_at,
  subnets: subnetIndex
});

await fs.rm(path.join(outputRoot, "subnets"), { recursive: true, force: true });
for (const subnet of mergedSubnets) {
  const subnetCandidates = candidatesByNetuid.get(subnet.netuid) || [];
  const subnetSurfaces = surfaces.filter((surface) => surface.netuid === subnet.netuid);
  await writeJson(path.join(outputRoot, `subnets/${subnet.netuid}.json`), {
    schema_version: 1,
    generated_at: generatedAt,
    subnet,
    candidate_surfaces: subnetCandidates,
    candidates: subnetCandidates,
    gaps: subnet.gaps,
    surfaces: subnetSurfaces,
    verified_surfaces: subnetSurfaces
  });
}

await writeJson(path.join(outputRoot, "surfaces.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  notes: "Curated and verified public interface surfaces only. Native-only subnet stubs do not invent surfaces.",
  surfaces
});

await writeJson(path.join(outputRoot, "candidates.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  notes: "Unverified candidate surfaces from public source discovery and community intake. Candidates are not verified registry surfaces.",
  candidates: candidateIndex
});

await writeJson(path.join(outputRoot, "review-queue.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  notes: "Candidate surfaces that need maintainer review before promotion into curated subnet overlays.",
  count: reviewQueue.length,
  candidates: reviewQueue
});

await writeJson(path.join(outputRoot, "curation.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  notes: "Curation status for every active Finney subnet.",
  curation: curationIndex
});

await writeJson(path.join(outputRoot, "gaps.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  notes: "Missing or unsupported public interface facets by subnet. Missing facets are not invented.",
  gaps: gapsIndex
});

await writeJson(path.join(outputRoot, "verification/latest.json"), {
  ...verification,
  generated_at: verification.generated_at || generatedAt
});

await writeJson(path.join(outputRoot, "metagraph/latest.json"), metagraphLatest);
await fs.rm(path.join(outputRoot, "health/subnets"), { recursive: true, force: true });
await fs.rm(path.join(outputRoot, "health/badges"), { recursive: true, force: true });
await writeJson(path.join(outputRoot, "health/latest.json"), healthArtifacts.latest);
await writeJson(path.join(outputRoot, "health/summary.json"), healthArtifacts.summary);
await writeJson(path.join(outputRoot, "rpc-endpoints.json"), rpcEndpoints);
for (const [netuid, subnetHealth] of healthArtifacts.subnets) {
  await writeJson(path.join(outputRoot, `health/subnets/${netuid}.json`), subnetHealth);
}
for (const [netuid, badge] of healthArtifacts.badges) {
  await writeJson(path.join(outputRoot, `health/badges/${netuid}.json`), badge);
}
await writeJson(path.join(outputRoot, "coverage.json"), coverage);
await writeJson(path.join(outputRoot, "contracts.json"), contracts);
await writeJson(path.join(outputRoot, "schema-drift.json"), schemaDriftPlaceholder);
await writeJson(path.join(outputRoot, "schemas/index.json"), {
  schema_version: 1,
  contract_version: contractVersion,
  generated_at: generatedAt,
  source: "artifact-build",
  notes: "Run npm run schemas:snapshot to capture machine-readable OpenAPI/Swagger schema snapshots.",
  schemas: []
});
await writeJson(path.join(outputRoot, "review/curation.json"), curationReview);
await writeJson(path.join(outputRoot, "review/gap-priorities.json"), {
  schema_version: 1,
  contract_version: contractVersion,
  generated_at: generatedAt,
  priorities: curationReview.gap_priorities
});
await writeJson(path.join(outputRoot, "review/adapter-candidates.json"), {
  schema_version: 1,
  contract_version: contractVersion,
  generated_at: generatedAt,
  candidates: curationReview.adapter_candidates
});
await writeJson(path.join(outputRoot, "review/maintainer-decisions.json"), {
  schema_version: 1,
  contract_version: contractVersion,
  generated_at: generatedAt,
  decisions: reviewDecisions.decisions || [],
  notes: "Public-safe maintainer curation decisions only. No secrets, wallets, PATs, private dashboards, or validator-local state."
});

for (const [slug, artifact] of Object.entries(adapterArtifacts)) {
  await writeJson(path.join(outputRoot, `adapters/${slug}.json`), artifact);
}

const artifactSizes = await collectArtifactSizes(outputRoot);
await writeJson(path.join(outputRoot, "build-summary.json"), {
  schema_version: 1,
  contract_version: contractVersion,
  generated_at: generatedAt,
  adapter_count: Object.keys(adapterArtifacts).length,
  artifact_count: artifactSizes.length,
  artifact_size_bytes: artifactSizes.reduce((sum, artifact) => sum + artifact.size_bytes, 0),
  artifacts: artifactSizes.slice(0, 250),
  candidate_count: candidates.length,
  coverage,
  provider_count: providers.length,
  subnet_count: mergedSubnets.length,
  surface_count: surfaces.length,
  public_contract: {
    version: contractVersion,
    url: "/metagraph/contracts.json"
  }
});

console.log(`Built ${mergedSubnets.length} subnet(s), ${surfaces.length} surface(s), and ${providers.length} provider(s).`);

function mergeSubnet(nativeSubnet, overlay, candidateCount) {
  const surfaceCount = overlay?.surfaces?.length || 0;
  const probedSurfaceCount = overlay?.surfaces?.filter((surface) => surface.probe?.enabled).length || 0;
  const coverageLevel = surfaceCount === 0 ? "native-only" : probedSurfaceCount > 0 ? "probed" : "manifested";
  const slug = overlay?.slug || `sn-${nativeSubnet.netuid}`;

  return {
    block: nativeSubnet.block,
    candidate_count: candidateCount,
    categories: overlay?.categories || (nativeSubnet.netuid === 0 ? ["root", "system"] : ["native-only"]),
    coverage_level: coverageLevel,
    dashboard_url: overlay?.dashboard_url || null,
    docs_url: overlay?.docs_url || null,
    gaps: buildGaps(overlay?.surfaces || [], overlay),
    mechanism_count: nativeSubnet.mechanism_count,
    name: overlay?.name || nativeSubnet.name || `Subnet ${nativeSubnet.netuid}`,
    native_name: nativeSubnet.name || null,
    native_slug: slugify(nativeSubnet.name || `subnet-${nativeSubnet.netuid}`),
    netuid: nativeSubnet.netuid,
    notes: overlay?.notes || null,
    participant_count: nativeSubnet.participant_count,
    probed_surface_count: probedSurfaceCount,
    provenance: {
      existence: {
        authority: "native-chain",
        captured_at: nativeSnapshot.captured_at,
        method: nativeSnapshot.source.method,
        network: nativeSnapshot.network,
        source_kind: nativeSnapshot.source.kind
      },
      interface_metadata: overlay ? overlay.curation?.level || "curated-overlay" : "none"
    },
    registered_at_block: nativeSubnet.registered_at_block,
    slug,
    source_repo: overlay?.source_repo || null,
    status: nativeSubnet.status,
    subnet_type: nativeSubnet.subnet_type,
    surface_count: surfaceCount,
    symbol: nativeSubnet.symbol,
    tempo: nativeSubnet.tempo,
    website_url: overlay?.website_url || null,
    curation: overlay?.curation || {
      level: overlay ? "candidate-discovered" : "native",
      review_state: "unreviewed",
      reviewed_at: null,
      verified_at: null,
      source_count: 0,
      gap_notes: []
    },
    links: overlay?.links || []
  };
}

function buildGaps(surfaces, overlay) {
  const kinds = new Set(surfaces.map((surface) => surface.kind));
  if (overlay?.docs_url) {
    kinds.add("docs");
  }
  if (overlay?.source_repo) {
    kinds.add("source-repo");
  }
  if (overlay?.website_url) {
    kinds.add("website");
  }
  if (overlay?.dashboard_url) {
    kinds.add("dashboard");
  }
  const expectedKinds = ["docs", "source-repo", "website", "dashboard", "openapi", "subnet-api", "sse", "data-artifact"];
  const missingKinds = expectedKinds.filter((kind) => !kinds.has(kind));
  return {
    missing_kinds: missingKinds,
    supported_kinds: [...kinds].sort(),
    gap_notes: overlay?.curation?.gap_notes || []
  };
}

function countBy(items, keyOrFn) {
  return Object.fromEntries(
    Object.entries(
      items.reduce((accumulator, item) => {
        const key = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b))
  );
}

function groupByNetuid(items) {
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.netuid) || [];
    group.push(item);
    groups.set(item.netuid, group);
  }
  return groups;
}

function buildHealthArtifacts(surfaceHealth, subnets, options) {
  const byNetuid = groupByNetuid(surfaceHealth);
  const subnetArtifacts = new Map();
  const badgeArtifacts = new Map();
  const summaryRows = [];

  for (const subnet of subnets) {
    const subnetSurfaces = byNetuid.get(subnet.netuid) || [];
    const okCount = subnetSurfaces.filter((surface) => surface.status === "ok").length;
    const failedCount = subnetSurfaces.filter((surface) => surface.status === "failed").length;
    const unknownCount = subnetSurfaces.filter((surface) => surface.status === "unknown").length;
    const degradedCount = subnetSurfaces.filter((surface) => surface.status === "degraded").length;
    const status = classifySubnetStatus({ okCount, failedCount, unknownCount, degradedCount, surfaceCount: subnetSurfaces.length });
    const summary = {
      netuid: subnet.netuid,
      slug: subnet.slug,
      name: subnet.name,
      status,
      surface_count: subnetSurfaces.length,
      ok_count: okCount,
      failed_count: failedCount,
      degraded_count: degradedCount,
      unknown_count: unknownCount,
      last_checked: latestString(subnetSurfaces.map((surface) => surface.verified_at || surface.last_checked)),
      last_ok: latestString(subnetSurfaces.map((surface) => surface.last_ok)),
      avg_latency_ms: average(
        subnetSurfaces
          .filter((surface) => Number.isFinite(surface.latency_ms))
          .map((surface) => surface.latency_ms)
      )
    };

    summaryRows.push(summary);
    subnetArtifacts.set(subnet.netuid, {
      schema_version: 1,
      contract_version: contractVersion,
      generated_at: options.generatedAt,
      netuid: subnet.netuid,
      slug: subnet.slug,
      name: subnet.name,
      summary,
      surfaces: subnetSurfaces
    });
    badgeArtifacts.set(subnet.netuid, {
      schema_version: 1,
      contract_version: contractVersion,
      generated_at: options.generatedAt,
      netuid: subnet.netuid,
      label: `SN${subnet.netuid}`,
      message: status,
      status,
      color: badgeColor(status),
      surface_count: subnetSurfaces.length,
      ok_count: okCount,
      failed_count: failedCount,
      unknown_count: unknownCount
    });
  }

  const latest = {
    schema_version: 1,
    contract_version: contractVersion,
    generated_at: options.generatedAt,
    source: options.source,
    notes: options.notes,
    summary: {
      surface_count: surfaceHealth.length,
      status_counts: countBy(surfaceHealth, (surface) => surface.status),
      classification_counts: countBy(surfaceHealth, (surface) => surface.classification || "unknown")
    },
    surfaces: surfaceHealth
  };

  return {
    latest,
    summary: {
      schema_version: 1,
      contract_version: contractVersion,
      generated_at: options.generatedAt,
      source: options.source,
      global: latest.summary,
      subnets: summaryRows.sort((a, b) => a.netuid - b.netuid)
    },
    subnets: subnetArtifacts,
    badges: badgeArtifacts
  };
}

function buildCurationReview(subnets, surfaces, candidates, verificationArtifact, reviewDecisionsDocument) {
  const surfacesByNetuid = groupByNetuid(surfaces);
  const candidatesByNetuid = groupByNetuid(candidates);
  const verificationByCandidate = new Map((verificationArtifact.results || []).map((result) => [result.candidate_id, result]));
  const gapPriorities = subnets
    .map((subnet) => {
      const subnetSurfaces = surfacesByNetuid.get(subnet.netuid) || [];
      const subnetCandidates = candidatesByNetuid.get(subnet.netuid) || [];
      const missingKinds = subnet.gaps.missing_kinds || [];
      const verifiedCandidateCount = subnetCandidates.filter((candidate) =>
        ["live", "redirected"].includes(verificationByCandidate.get(candidate.id)?.classification)
      ).length;
      return {
        netuid: subnet.netuid,
        slug: subnet.slug,
        name: subnet.name,
        curation_level: subnet.curation.level,
        review_state: subnet.curation.review_state,
        surface_count: subnetSurfaces.length,
        candidate_count: subnetCandidates.length,
        verified_candidate_count: verifiedCandidateCount,
        missing_kinds: missingKinds,
        priority_score: reviewPriorityScore(subnet, subnetSurfaces, subnetCandidates),
        suggested_next_action: suggestedReviewAction(subnet, subnetSurfaces, subnetCandidates)
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score || b.candidate_count - a.candidate_count || a.netuid - b.netuid);

  const adapterCandidates = subnets
    .map((subnet) => {
      const subnetSurfaces = surfacesByNetuid.get(subnet.netuid) || [];
      const operationalKinds = subnetSurfaces.filter((surface) =>
        ["openapi", "subnet-api", "sse", "data-artifact"].includes(surface.kind)
      );
      return {
        netuid: subnet.netuid,
        slug: subnet.slug,
        name: subnet.name,
        curation_level: subnet.curation.level,
        operational_surface_count: operationalKinds.length,
        operational_kinds: [...new Set(operationalKinds.map((surface) => surface.kind))].sort(),
        candidate_api_count: (candidatesByNetuid.get(subnet.netuid) || []).filter((candidate) =>
          ["openapi", "subnet-api", "sse", "data-artifact"].includes(candidate.kind)
        ).length,
        priority_score: operationalKinds.length * 20 + subnet.surface_count
      };
    })
    .filter((candidate) => candidate.operational_surface_count > 0 || candidate.candidate_api_count > 0)
    .sort((a, b) => b.priority_score - a.priority_score || a.netuid - b.netuid);

  return {
    schema_version: 1,
    contract_version: contractVersion,
    generated_at: generatedAt,
    notes: "Backend curation review report. Machine-generated entries still need maintainer review before being treated as hand-curated truth.",
    summary: {
      subnet_count: subnets.length,
      needs_maintainer_review_count: subnets.filter((subnet) => subnet.curation.review_state !== "maintainer-reviewed").length,
      maintainer_decision_count: reviewDecisionsDocument.decisions?.length || 0,
      adapter_candidate_count: adapterCandidates.length,
      gap_kind_counts: countGapKinds(subnets)
    },
    gap_priorities: gapPriorities,
    adapter_candidates: adapterCandidates,
    review_decisions: reviewDecisionsDocument.decisions || []
  };
}

function buildSchemaDriftPlaceholder(surfaces) {
  const openapiSurfaces = surfaces.filter((surface) => surface.kind === "openapi");
  return {
    schema_version: 1,
    contract_version: contractVersion,
    generated_at: generatedAt,
    source: "artifact-build",
    status: "not-snapshotted",
    notes: "Run npm run schemas:snapshot to fetch machine-readable OpenAPI/Swagger JSON and update drift status.",
    openapi_surface_count: openapiSurfaces.length,
    schema_backed_surface_count: openapiSurfaces.filter((surface) => surface.schema_url).length,
    surfaces: openapiSurfaces.map((surface) => ({
      netuid: surface.netuid,
      subnet_slug: surface.subnet_slug,
      surface_id: surface.id,
      url: surface.url,
      schema_url: surface.schema_url || null,
      status: surface.schema_url ? "pending-snapshot" : "ui-only-or-undiscovered"
    }))
  };
}

function buildContracts() {
  return {
    schema_version: 1,
    contract_version: contractVersion,
    generated_at: generatedAt,
    name: "Metagraphed public backend artifact contract",
    primary_domain: "metagraph.sh",
    status_domain: null,
    base_path: "/metagraph",
    notes: [
      "Native Bittensor chain data is canonical for active subnet existence.",
      "Curated overlays are canonical for public interface metadata.",
      "Candidate surfaces are discovery records only and are not published as verified registry surfaces.",
      "Health and schema artifacts are operational observations, not protocol authority."
    ],
    artifacts: [
      artifactContract("providers", "/metagraph/providers.json", "Provider/source registry."),
      artifactContract("subnets", "/metagraph/subnets.json", "All active Finney subnets with compact registry metadata."),
      artifactContract("subnet-detail", "/metagraph/subnets/{netuid}.json", "Per-subnet detail payload."),
      artifactContract("surfaces", "/metagraph/surfaces.json", "Curated public interface surfaces only."),
      artifactContract("candidates", "/metagraph/candidates.json", "Unpromoted candidate surfaces from public discovery."),
      artifactContract("coverage", "/metagraph/coverage.json", "Registry coverage counts and source precedence."),
      artifactContract("curation", "/metagraph/curation.json", "Curation state and gaps for every active subnet."),
      artifactContract("gaps", "/metagraph/gaps.json", "Missing public interface facets by subnet."),
      artifactContract("verification", "/metagraph/verification/latest.json", "Latest candidate verification snapshot."),
      artifactContract("health-latest", "/metagraph/health/latest.json", "Latest surface health snapshot."),
      artifactContract("health-summary", "/metagraph/health/summary.json", "Global and per-subnet health rollup."),
      artifactContract("health-subnet", "/metagraph/health/subnets/{netuid}.json", "Per-subnet health payload for metagraph.sh consumers."),
      artifactContract("health-badge", "/metagraph/health/badges/{netuid}.json", "Badge data contract for status rendering."),
      artifactContract("rpc-endpoints", "/metagraph/rpc-endpoints.json", "Bittensor base-layer RPC endpoint registry and probe status."),
      artifactContract("schema-drift", "/metagraph/schema-drift.json", "OpenAPI schema snapshot/drift status."),
      artifactContract("schema-index", "/metagraph/schemas/index.json", "Index of captured machine-readable schemas."),
      artifactContract("review-curation", "/metagraph/review/curation.json", "Maintainer curation and adapter candidate report."),
      artifactContract("review-decisions", "/metagraph/review/maintainer-decisions.json", "Public-safe maintainer review decision ledger.")
    ]
  };
}

function artifactContract(id, pathValue, description) {
  return {
    id,
    path: pathValue,
    description,
    content_type: "application/json",
    contract_version: contractVersion
  };
}

async function collectArtifactSizes(root) {
  const files = [];
  await walk(root, async (filePath) => {
    if (!filePath.endsWith(".json")) {
      return;
    }
    const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
    if (relativePath === "build-summary.json") {
      return;
    }
    const stat = await fs.stat(filePath);
    files.push({
      path: relativePath,
      size_bytes: stat.size
    });
  });
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function loadAdapterSnapshots() {
  const files = await listJsonFilesRecursive(path.join(repoRoot, "registry/adapters/latest"));
  const snapshots = await Promise.all(files.map(readJson));
  return new Map(snapshots.map((snapshot) => [snapshot.slug, snapshot]));
}

async function loadReviewDecisions() {
  try {
    return await readJson(path.join(repoRoot, "registry/reviews/maintainer-reviewed.json"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schema_version: 1,
        generated_at: generatedAt,
        decisions: []
      };
    }
    throw error;
  }
}

async function walk(dirPath, onFile) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, onFile);
    } else if (entry.isFile()) {
      await onFile(entryPath);
    }
  }
}

function reviewPriorityScore(subnet, surfacesForSubnet, candidatesForSubnet) {
  const missingKinds = subnet.gaps.missing_kinds || [];
  const highValueMissing = missingKinds.filter((kind) => ["source-repo", "docs", "website", "openapi", "subnet-api"].includes(kind));
  const adapterBonus = surfacesForSubnet.filter((surface) => ["openapi", "subnet-api", "sse", "data-artifact"].includes(surface.kind)).length * 8;
  const machineReviewPenalty = subnet.curation.review_state === "maintainer-reviewed" ? -25 : 20;
  return highValueMissing.length * 12 + candidatesForSubnet.length + adapterBonus + machineReviewPenalty;
}

function suggestedReviewAction(subnet, surfacesForSubnet, candidatesForSubnet) {
  if (subnet.curation.review_state !== "maintainer-reviewed" && surfacesForSubnet.length > 0) {
    return "review promoted surfaces and mark maintainer-reviewed where provenance is strong";
  }
  if ((subnet.gaps.missing_kinds || []).includes("source-repo") && candidatesForSubnet.length > 0) {
    return "inspect source-repo/docs candidates for official provenance";
  }
  if (surfacesForSubnet.some((surface) => ["openapi", "subnet-api", "sse"].includes(surface.kind))) {
    return "evaluate for subnet-specific adapter";
  }
  return "keep baseline entry and wait for public-source or community intake";
}

function countGapKinds(subnets) {
  return Object.fromEntries(
    Object.entries(
      subnets.reduce((accumulator, subnet) => {
        for (const kind of subnet.gaps.missing_kinds || []) {
          accumulator[kind] = (accumulator[kind] || 0) + 1;
        }
        return accumulator;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b))
  );
}

function classifySubnetStatus({ okCount, failedCount, unknownCount, degradedCount, surfaceCount }) {
  if (surfaceCount === 0 || unknownCount === surfaceCount) {
    return "unknown";
  }
  if (failedCount === 0 && degradedCount === 0) {
    return "ok";
  }
  if (okCount > 0 || degradedCount > 0) {
    return "degraded";
  }
  return "failed";
}

function badgeColor(status) {
  return (
    {
      ok: "brightgreen",
      degraded: "yellow",
      failed: "red",
      unknown: "lightgrey"
    }[status] || "lightgrey"
  );
}

function latestString(values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
