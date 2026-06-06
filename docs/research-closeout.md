# Research Plan Closeout

This tracks the original Bittensor public-infra research plan against the current Metagraphed backend.

## Handled

- Chain-first all-subnet registry for active Finney netuids.
- Generated native snapshot and per-subnet public artifacts.
- Curated overlays for every active netuid.
- Candidate discovery from TaoMarketCap, Tensorplex subnet-docs, Taopedia articles, GitHub, READMEs, and public websites.
- Candidate verification with safe read-only probes and classification metadata.
- Public health artifacts under `metagraph.sh/metagraph/health/*`.
- Root/system base-layer RPC/WSS surfaces for official and public provider endpoints.
- RPC probes for `chain_getHeader`, `system_health`, `rpc_methods`, and safe archive capability.
- OpenAPI snapshot/drift support, currently schema-backed for Allways.
- Allways and Gittensor adapter-backed pilot artifacts.
- Maintainer review decision ledger and promotion command.
- Scheduled sync workflow that opens PRs instead of direct-pushing generated changes.
- Public-safety scan for secrets, wallet/PAT/private URL risks, and unsafe local/private data.
- `metagraph.sh` as the only v1 domain.

## Partial

- Base-layer RPC/provider landscape now has root/system provider manifests and public endpoint probes, but more providers should be promoted only when exact public-safe endpoint URLs are verified.
- Allways adapter captures response shape, hashes, counts, SSE shape, and freshness metadata; deeper protocol analytics such as swap lifecycle rates and crown history rollups are later adapter work.
- Gittensor adapter captures public repository config, emission/maintainer-cut aggregates, GitHub repo metadata, and docs-only bounty/contribution status; no unauthenticated bounty API has been verified yet.
- Schema validation is stronger through custom artifact validation and schema contracts, but strict AJV-style per-artifact validation remains optional.
- Sync PR summaries now compute artifact diffs, but future summaries can add richer historical health recovery/failure comparisons.

## Deferred

- UI, pages, styling, and visual badge rendering.
- `subnet.health`; it is not used for v1.
- Historical/deregistered/testnet subnet archives.
- Publishing owner keys, hotkeys, coldkeys, wallet data, PATs, credentialed GitHub flows, validator-local state, or private dashboards.
- Hosted/load-balanced endpoints, owned lite/archive nodes, mirrors, caches, and other recurring infra/OPEX services.
- Grant/budget proposal packaging for hosted infrastructure milestones.

## Current Product Line

Metagraphed is registry/status/indexer first. Generic RPC hosting is not the wedge; RPC endpoint health is listed as operational metadata for builders.
