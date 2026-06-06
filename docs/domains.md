# Domain Plan

## Primary

`metagraph.sh`

Use this for the product, docs, static UI, status data, badge data, health JSON, generated registry artifacts, and future API-style static artifact consumption.

Expected backend routes:

- `/metagraph/contracts.json`
- `/metagraph/subnets.json`
- `/metagraph/subnets/{netuid}.json`
- `/metagraph/surfaces.json`
- `/metagraph/rpc-endpoints.json`
- `/metagraph/health/latest.json`
- `/metagraph/health/summary.json`
- `/metagraph/health/subnets/{netuid}.json`
- `/metagraph/health/badges/{netuid}.json`
- `/metagraph/schema-drift.json`
- `/metagraph/schemas/index.json`
- `/metagraph/adapters/allways.json`
- `/metagraph/adapters/gittensor.json`
- `/metagraph/review/curation.json`
- `/metagraph/review/maintainer-decisions.json`

## Reserved Domains

Do not use `subnet.health` for Metagraphed v1. It is reserved for a separate future idea and should not appear in registry, health, badge, probe, or status contracts.

## Copy Boundary

Use:

> Metagraphed extends the native Bittensor metagraph with public interface and health metadata.

Avoid:

> Metagraphed is the Bittensor metagraph.

The project is unofficial and must not imply OpenTensor/Bittensor endorsement.
