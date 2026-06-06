# Metagraphed Backend Artifact Contracts

Metagraphed v1 is backend-first. The public contract is static JSON under `https://metagraph.sh/metagraph/*`; UI work can consume these artifacts later without changing the registry pipeline.

## Contract Rules

- `registry/native/finney-subnets.json` is canonical for active Finney subnet existence.
- `registry/subnets/**/*.json` is canonical for curated public interface metadata.
- `registry/candidates/**/*.json` is discovery-only. Candidates are not verified registry surfaces until promotion.
- `registry/adapters/latest/*.json` stores safe adapter snapshots for subnet-specific public metrics.
- `registry/reviews/maintainer-reviewed.json` stores public-safe maintainer review decisions.
- `public/metagraph/*` files are generated projections and should not be edited by hand.
- Health, RPC, adapter, and schema-drift artifacts are operational observations, not protocol authority.
- No secrets, wallet data, PATs, private dashboards, or validator-sensitive flows belong in any public artifact.

## Core Artifacts

- `/metagraph/contracts.json`: current public artifact contract version and artifact map.
- `/metagraph/providers.json`: provider/source registry.
- `/metagraph/subnets.json`: compact all-subnet index.
- `/metagraph/subnets/{netuid}.json`: per-subnet detail with native data, curated surfaces, candidates, curation, and gaps.
- `/metagraph/surfaces.json`: curated public surfaces only.
- `/metagraph/rpc-endpoints.json`: Bittensor base-layer RPC/WSS endpoint registry and probe status.
- `/metagraph/candidates.json`: unpromoted candidate surfaces from public discovery.
- `/metagraph/coverage.json`: count parity and coverage levels.
- `/metagraph/curation.json`: curation state for every active subnet.
- `/metagraph/gaps.json`: missing public interface facets by subnet.
- `/metagraph/verification/latest.json`: latest candidate verification results.
- `/metagraph/health/latest.json`: latest live or build-time surface health snapshot.
- `/metagraph/health/summary.json`: global and per-subnet health rollup.
- `/metagraph/health/subnets/{netuid}.json`: per-subnet health detail.
- `/metagraph/health/badges/{netuid}.json`: badge data for future metagraph.sh renderers.
- `/metagraph/schema-drift.json`: OpenAPI snapshot/drift status.
- `/metagraph/schemas/index.json`: captured machine-readable schema index.
- `/metagraph/adapters/allways.json`: Allways adapter-backed public metrics snapshot.
- `/metagraph/adapters/gittensor.json`: Gittensor adapter-backed public metrics snapshot.
- `/metagraph/review/curation.json`: maintainer review and adapter candidate report.
- `/metagraph/review/gap-priorities.json`: prioritized backend curation gaps.
- `/metagraph/review/adapter-candidates.json`: subnets likely worth custom adapters.
- `/metagraph/review/maintainer-decisions.json`: public-safe maintainer decision ledger.

## Backend Commands

- `npm run build`: regenerate deterministic public artifacts from current registry inputs.
- `npm run validate`: validate native snapshot, overlays, candidates, review decisions, generated artifacts, and required schemas.
- `npm run sync:subnets`: update the native Finney snapshot.
- `npm run discover:candidates`: refresh public-source candidate discovery.
- `npm run verify:candidates`: safely verify public candidates.
- `npm run curate:baseline`: promote verified candidates into generated overlays.
- `npm run review:promote`: apply public-safe maintainer review decisions to overlays.
- `npm run schemas:snapshot`: fetch machine-readable OpenAPI/Swagger JSON snapshots and update schema drift.
- `npm run adapters:snapshot`: capture safe Allways/Gittensor public adapter summaries.
- `METAGRAPH_WRITE_PROBE_RESULTS=1 npm run probes:smoke`: run live read-only probes and persist health/RPC history.
- `npm run sync:summary`: generate a registry-refresh PR summary from actual artifact diffs.

## Current Domain Scope

Use `metagraph.sh` for the current launch. Do not use `subnet.health` for v1 registry, status, badge, health, or probe contracts.
