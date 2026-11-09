# Netcozy Connect implementation plan

## Approval and scope

Phase 1 was explicitly approved by the user. Complete the shared core and stop before Phase 2. Supabase replaces the original Prisma recommendation. Preserve the navy/teal design direction and existing foundation checks.

## Existing state

Phase 0 scaffold, environment validation, API reachability probe and five infrastructure tests exist. The user independently verified Supabase API reachability. Application install/build verification was previously blocked by network EACCES. No remote tables have been created by this agent; no production migration is authorized.

## Phase 1 implementation order

1. Resolve local package installation from available cache; produce a portable lockfile; validate lint/typecheck/build.
2. Add versioned additive Supabase SQL migrations, RLS, immutable consent/audit history, deterministic fictitious seed records and database tests.
3. Implement Supabase Auth email/password signup, confirmation, sign-in/out and server-held session refresh with HTTP-only cookies. Never implement password cryptography.
4. Implement own profile, industry/intent/goal onboarding, multiple goals, honest demo identity verification and privacy/consent settings.
5. Implement deterministic scoring with reasons, weights, filters, saved/dismissed matches and saved searches.
6. Implement approved versioned templates, reviewed outreach drafts, manual-only send assistance and separate pipeline categories.
7. Implement restricted admin overview, verification/role/template/rules management and immutable audit history.
8. Run meaningful scoring, consent, authorization, SQL/RLS and UI tests; fix implementation errors; document remaining external blockers and stop.

## Decisions and dependencies

- Server-only Supabase HTTP API adapter uses the published Auth and PostgREST interfaces. HTTP-only, Secure-in-production, SameSite cookies hold provider tokens; every private request validates the user with Supabase. Browser code never receives access/refresh tokens or service-role keys.
- Supabase SQL migrations are reviewed files under supabase/migrations. No existing database reset, destructive migration, production deployment or outbound messaging is included.
- Only the supplied project URL and publishable key are available. Applying migrations requires the project's owner using the SQL editor/CLI or authorized database tooling. Do not invent elevated credentials.
- All sample people/opportunities are fictitious and explicitly DEMO. No fake LinkedIn profiles are opened and no social/SMS/WhatsApp send adapter exists.
- Real identity/LinkedIn import integrations are BLOCKED. Demo identity outcomes are never displayed as real verification; ID photos are never collected.
- Phase 1 is personal-account scoped. Domain organization workflows and marketplace modules remain in their approved later phases.

## Verification

In progress. Report actual commands/results and distinguish in-process PostgreSQL tests, mocked UI integration tests and live Supabase checks. Live Auth email delivery and remote migration/RLS checks remain external until exercised with a configured development project.

## Phase boundary

Phase 2 real estate/forms, Phase 3 domain modules and Phase 4 LI3K/production hardening are not approved and must not start.

## Verification progress

- Initial Phase 1 test suite: 27 passed, 0 failed. Includes fourteen database access/consent/review/role boundary cases on real PGlite PostgreSQL plus scoring/configuration cases.
- Production build passed; TypeScript and ESLint zero-warning checks passed before final minor updates.
- Browser integration passed across simulated signup/email confirmation, atomic onboarding, matching, save feedback, draft/review, pipeline stage, consent withdrawal, rejected sends/role escalation, admin template creation, mobile layout and logout. It runs actual app server routes and SQL/RLS against an explicitly test-only Supabase HTTP fixture; real Supabase Auth/email is not claimed as verified.
- Visual review: inspected the generated desktop and mobile dashboard screenshots; mobile has no document overflow. Temporary screenshots live in ignored .npm-cache.
- Package recovery: an ignored loopback-only cache server served existing integrity-checked npm cache artifacts. The delivered lockfile uses canonical https://registry.npmjs.org URLs, never the temporary loopback registry. Type definitions use the compatible cached Node 22 types while the runtime remains Node 24; application typecheck/build passed.
- Clean install: first discovered missing optional cross-platform metadata, regenerated the complete lockfile from cached metadata. A subsequent in-place npm ci was blocked by Windows locking a loaded native Next.js binary. The working dependencies were restored successfully. A fresh isolated npm ci --offline --ignore-scripts --no-audit then passed (348 packages), verifying the complete portable lockfile. The in-place Windows cleanup warning does not affect the fresh install.
- Dependency audit: npm audit attempted; advisory endpoint unreachable. No vulnerability-free claim is made.
- Final checks after the last source revisions: npm run lint, npm run typecheck, npm test (27/27), npm run format:check and npm run build all passed. The expanded npm run test:browser passed, including multiple industry goals, saved searches, HTTP-only cookie refresh and cross-origin request rejection.

## Remaining external acceptance

The user reported Supabase API reachability. No hosted migration, Auth account or production integration has been created/changed by the agent. Prepared reviewed migrations and instructions are in SUPABASE_SETUP.md. The supplied URL/publishable key cannot create schema or bootstrap an administrator. Those owner-authorized development project steps plus actual confirmation email and two-user hosted acceptance must still be completed before declaring Phase 1 fully done. The agent environment remains unable to reach external providers directly.

## Phase 1 delivery status

Shared-core code and local verification are complete. Hosted acceptance remains open, so Phase 1 is not declared fully complete. No Phase 2 work was started. Application code/configuration, the portable lockfile, two reviewed migrations, deterministic demo records, meaningful tests and SUPABASE_SETUP.md are ready for review. No production integration or remote mutation was performed.
