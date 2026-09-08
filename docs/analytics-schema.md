# Extension API contract

Current sender contract: [packaged review note](../public/review/analytics-api-contract.txt).
It documents catalog, operational organization connect and opt-in learning events
separately. Full schemas are generated into `dist/review/api-schemas.json` from
`src/shared/protocol/schemas.json`; these match backend OpenAPI and validators.

Network entry points: `fetchCatalog` in `api-client.ts`, `requestOrganization`
in `organization.ts`, `flushStats` in `stats.ts`. No network sender in content code.
Current learning events use v2 only. `/api/events` and `/api/snapshot` remain backend
compatibility routes for 0.1.1, not active senders in this extension.

See [privacy policy](privacy-policy.md) for public organization data and retention.
Build generates executable paths/search markers in `dist/review/code-map.txt`.
