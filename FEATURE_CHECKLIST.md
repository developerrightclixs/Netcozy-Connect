# Netcozy Connect feature checklist

## Phase 0 foundation

- [x] Audit instructions, repository and toolchain; preserve the phase approval boundary.
- [x] Maintain implementation plan and feature checklist.
- [x] Next.js/React/TypeScript scaffold and responsive navy/teal interface.
- [x] Supabase environment validation and read-only API check; user verified real API reachability.
- [x] Coding, test and security conventions; .env ignored and secrets not printed.
- [x] Dependency installation recovered from a local cache; portable lockfile generated.
- [x] Lint, TypeScript, build and initial infrastructure tests have passed.
- [ ] Dependency advisory audit remains blocked by external registry access.

## Phase 1 shared core - APPROVED

- [x] Supabase email/password signup, email link/code confirmation, resend, sign-in/out and server-side refresh.
- [x] HTTP-only session cookies, provider user validation, same-origin mutations and server input validation.
- [x] Server-controlled multiple roles; super-admin-only ordinary role assignment, operator-managed super-admin bootstrap.
- [x] Additive shared-core migrations, Auth profile/member trigger/backfill and RLS on every application table.
- [x] Guided industry/intent onboarding with atomic profile/first-goal/consent save.
- [x] Typed demo identity adapter storing outcomes/references only; no ID-photo collection or real-verification claims.
- [x] Editable private profiles; add/edit/pause/reactivate multiple goal profiles.
- [x] Immutable consent evidence and withdrawal, contact/channel preferences and activity history.
- [x] Explainable deterministic matching with configurable weights and twelve fictitious database seed records.
- [x] Goal/industry/intent eligibility, region/skills/availability ranking, filters, saved searches and saved/dismissed feedback.
- [x] Recompute matches on workspace reads; exclude dismissed matches and closed pipeline outcomes.
- [x] Approved immutable template versions with preview/history and personalized outreach drafts.
- [x] Explicit draft review, edit invalidation, reviewed-message copying and no automatic send routes.
- [x] Personal/B2B/recruitment pipeline board and card-table views, stages and notes.
- [x] Server/database gates for consent, ownership and reviewed drafts before advanced stages.
- [x] Admin profile/role overview, demo verification review, templates, matching rules, provider status and audit CSV.
- [x] Privacy export/deletion requests and admin status queue; no claim of automatic request fulfillment.
- [x] Loading, error and empty states, semantic forms, keyboard focus and mobile layout.
- [x] Scoring/consent tests plus PostgreSQL migration/RLS tests: 27 tests passed on the final revision.
- [x] Browser workflow through actual UI/server routes and PostgreSQL, with simulated Supabase Auth: passed on the final revision.
- [x] Document concrete development migration, Auth configuration and administrator setup in SUPABASE_SETUP.md.
- [x] Clean lockfile install in a fresh directory and final format/lint/typecheck/test/build/browser verification all passed.
- [ ] Apply reviewed migrations to the authorized development Supabase project and verify hosted RLS.
- [ ] Verify actual email delivery/confirmation and real-user end-to-end acceptance in the hosted development project.

Phase 1 implementation is prepared and locally exercised; it is not declared fully complete while hosted acceptance remains pending. The publishable key does not authorize schema creation or administrator bootstrap. Real identity/LinkedIn integrations and external sends are explicitly unavailable.

## Phase 2 - NOT APPROVED / not started

- [ ] Real estate management/import, verification, developer matching and owner outreach logging.
- [ ] Partner forms with mandatory approval and audit history.

## Phase 3 - NOT APPROVED / not started

- [ ] Talent/tester recruitment and opt-in acquisition.
- [ ] Yachts/aviation agent marketplace.
- [ ] Vehicle dealer/broker marketplace.
- [ ] Events, checkout and ticketing.

## Phase 4 - NOT APPROVED / not started

- [ ] LI3K creative workflows and usage reporting.
- [ ] Authorized live marketing/provider integrations.
- [ ] Production security hardening, monitoring, deployment, backups and restoration.

### Phase 1 authentication deployment correction

- [x] Distinguish server configuration failures from field-validation and provider errors.
- [x] Add safe field-specific errors, strict request validation and redacted event diagnostics.
- [x] Regression suite: 31 tests passed, production build/TypeScript passed, missing-environment compiled-app check passed.
- [ ] Confirm the deployed issue after redeploying the updated code and configuring the actual Vercel environment.
