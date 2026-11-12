# Engineering conventions

## Workflow and code

Respect the user's phase approval boundary. Keep IMPLEMENTATION_PLAN.md and FEATURE_CHECKLIST.md current. Preserve working code and the approved design. Record architecture changes before adding parallel abstractions.

Use strict TypeScript for application code, small focused modules, server components by default, accessible semantic markup and explicit loading/empty/error states for interactive flows. Plain .mjs is allowed for dependency-free Node infrastructure and tests. Use ESLint with zero warnings. Use navy/teal and light surfaces as documented direction; the Phase 0 placeholder does not establish the final product design. Tailwind and reusable form/component libraries can be introduced when UI workflows are authorized.

Use Supabase PostgreSQL and versioned Supabase SQL migrations once domain models are approved. Review generated SQL and data impact; never reset a shared database or edit applied migrations. Seed only clearly labelled fictitious records. Wrap dependent writes in transactions, enforce ownership and unique constraints, and index actual query paths.

## Testing

Run lint, typecheck, tests and build after substantive changes. Test behavior and negative cases, including access boundaries, validation and consent enforcement when these exist. Database changes require a real disposable PostgreSQL integration check. Never report a skipped or unavailable check as passed. Unit tests do not prove UI, database or production readiness. Add browser tests for user journeys when those journeys are implemented.

## Security

- Keep secrets in local .env or a managed secret store; never commit or print them. Never use NEXT_PUBLIC_ for secrets.
- Validate untrusted data on the server. Fail closed on authorization and missing provider configuration.
- Use established auth/session libraries and password hashing; no custom cryptography. Enforce roles, tenant and resource ownership in backend services.
- Retain ID verification outcomes/references only; do not store ID photographs. Keep documents private with access checks, size/type controls and signed URLs.
- Enforce consent, opt-outs, mandatory human review and manual social sends in backend services as applicable. Never scrape or simulate a live connection.
- Use structured, redacted logs without tokens, sensitive documents or unnecessary personal data. Audit sensitive mutations with actor/action/entity/time.
- Baseline response headers are configured in next.config.mjs. HTTPS/HSTS, CSP appropriate to the final application, rate limiting, CSRF protections, backups and restoration must be validated before production. Phase 0 is not production hardening.
- Use a dedicated Supabase development project. Enable RLS and least-privilege grants on exposed application tables; test policies with actual user sessions. Never expose a service-role/secret key or bypass RLS for normal user operations.
- Review dependencies and run npm audit when network access permits; record unavailable audit checks honestly. Maintain package-lock.json.

## External integrations

Phase 4 tooling maintenance pins `minimatch` to 11.0.1 only beneath `@typescript-eslint/typescript-estree` via npm overrides. The inherited 10.2.6 was affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249); the normal audit-fix preview did not clear it. The override leaves ESLint's separate minimatch 3 dependency intact. Keep the override until the upstream parser dependency supports a patched version, and verify lint/build when changing it. The lockfile install uses `--ignore-scripts`; no new runtime dependency was introduced.

Represent providers as DEMO, BLOCKED, CONFIGURED or VERIFIED. Missing permissions, keys, contracts or legal clearance must never silently enable a production path. Add typed provider interfaces with the phase that needs them; do not build future integrations early.
