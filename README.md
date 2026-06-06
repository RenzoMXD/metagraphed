# Metagraphed

Every subnet, metagraphed.

Metagraphed is an unofficial operational registry for Bittensor subnet interfaces, health, schemas, and public access metadata.

The native Bittensor metagraph tells you what is happening at the subnet protocol layer. Metagraphed adds the missing builder-facing layer around it: public APIs, OpenAPI/Swagger surfaces, dashboards, repositories, endpoint health, probe history, schema drift, and access notes.

## Domains

- `metagraph.sh` is the main product and public artifact surface.
- `subnet.health` is not used for Metagraphed v1.

Example routes:

- `https://metagraph.sh/subnets/7`
- `https://metagraph.sh/metagraph/subnets.json`
- `https://metagraph.sh/metagraph/health/subnets/7.json`
- `https://metagraph.sh/metagraph/health/badges/7.json`

## What This Is

- a registry of public subnet interfaces;
- a deterministic JSON artifact generator;
- a probe surface for safe public endpoints;
- a status layer for APIs, schemas, and public data surfaces;
- a foundation for future hosted/cache/load-balanced subnet access.

## What This Is Not

- not an official OpenTensor or Bittensor project;
- not a replacement for the native Bittensor metagraph;
- not another alpha dashboard, docs encyclopedia, or generic RPC provider;
- not a validator credential, wallet, or private scoring mirror.

## Registry Coverage

Metagraphed is chain-first:

- every active Finney netuid gets a native chain entry from decoded Bittensor/Subtensor data;
- root `netuid: 0` is included and labeled as root/system;
- root `netuid: 0` carries Bittensor base-layer RPC/WSS endpoint surfaces;
- curated overlays add public interface metadata after machine verification or maintainer review;
- third-party APIs are enrichment/candidate sources, not canonical existence sources.
- generated candidates capture public-source leads, but only live/redirected public-safe candidates become promoted surfaces.

Coverage levels:

- `native-only`: chain-derived subnet entry, no verified public interface metadata yet;
- `manifested`: curated interface metadata exists, but no default probe is enabled;
- `probed`: curated interface metadata exists and at least one safe read-only probe is configured.

Curation levels:

- `native`: chain-derived only;
- `candidate-discovered`: public-source leads exist but are not verified;
- `machine-verified`: live public surfaces were safely probed and promoted;
- `maintainer-reviewed`: a human reviewed the overlay;
- `adapter-backed`: subnet-specific public data dimensions are modeled.

## Pilot Overlays

The initial rich overlays track:

- Allways SN7: API health, protocol state, network overview, miners, leaderboard, reliability, events, crown data, and SSE.
- Gittensor SN74: public docs, repository registration surfaces, public master repository weights, bounty/contribution metadata concepts, maintainer-cut metadata, and public-safe aggregate registry surfaces.

Credentialed flows, wallet paths, validator-sensitive internals, private dashboards, and token-gated data are intentionally out of scope.

## Artifact Contract

Generated public artifacts live under `public/metagraph`:

- `subnets.json`
- `surfaces.json`
- `rpc-endpoints.json`
- `candidates.json`
- `review-queue.json`
- `curation.json`
- `gaps.json`
- `providers.json`
- `metagraph/latest.json`
- `health/latest.json`
- `health/summary.json`
- `health/subnets/{netuid}.json`
- `health/badges/{netuid}.json`
- `verification/latest.json`
- `coverage.json`
- `contracts.json`
- `schema-drift.json`
- `schemas/index.json`
- `subnets/{netuid}.json`
- `adapters/allways.json`
- `adapters/gittensor.json`
- `review/curation.json`
- `review/gap-priorities.json`
- `review/adapter-candidates.json`
- `review/maintainer-decisions.json`
- `build-summary.json`

The generated files are deterministic and suitable for static hosting, CI review, and downstream consumption.

## Local Commands

```bash
npm run validate
npm test
npm run build
npm run scan:public-safety
npm run sync:subnets:dry-run
npm run discover:candidates:dry-run
npm run verify:candidates:dry-run
npm run curate:baseline:dry-run
npm run review:promote:dry-run
npm run schemas:snapshot:dry-run
npm run adapters:snapshot:dry-run
npm run probes:smoke
```

`sync:subnets` uses the Bittensor Python SDK through `uvx` to fetch decoded native Finney subnet metadata without committing Python dependencies to this repo.

`discover:candidates` reads public enrichment sources and writes unverified candidate surfaces into `registry/candidates/generated/public-sources.json`.

`verify:candidates` safely checks candidate URLs and writes live/dead/auth/unsupported classifications into `registry/verification/latest.json`.

`curate:baseline` promotes verified public-safe candidates into generated baseline overlays for every active netuid that does not already have a hand-curated overlay.

`review:promote` applies public-safe maintainer review decisions from `registry/reviews/maintainer-reviewed.json`.

`schemas:snapshot` captures machine-readable OpenAPI/Swagger schema summaries and drift state.

`adapters:snapshot` captures safe Allways/Gittensor public adapter summaries without raw wallet, miner, PAT, or validator-local payloads.

`probes:smoke` performs read-only checks against public surfaces. It does not submit transactions, mutate subnet state, send wallet data, or use credentials.

## Repository Layout

```text
docs/                 product and operating notes
registry/native/      generated chain-derived subnet snapshots
registry/candidates/  unverified interface candidates pending review
registry/providers/   provider metadata
registry/reviews/     public-safe maintainer review decisions
registry/subnets/     curated subnet interface overlays
registry/verification/ generated candidate verification snapshots
schemas/              public JSON schema contracts
scripts/              validation, artifact generation, probe, and safety scripts
public/metagraph/     generated public JSON artifacts
tests/                node test runner checks
```

## License

MIT
