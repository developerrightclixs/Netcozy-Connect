# Netcozy Connect implementation plan

## Approval and scope

Current checkpoint (2026-11-10): the user resumed approved Phase 2 and supplied `Netcozy Connect.html` as the visual reference. Phase 2 property/forms code and local verification are implemented; hosted acceptance remains external. Earlier pause notes below describe the starting checkpoint, not the current status. Stop before Phase 3. The latest delivery section records verification and remaining dependencies.

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

## Vercel deployment support

The user is deploying Phase 1 to Vercel. Reviewed Node 24 compatibility, server-only environment names, HTTPS cookies, canonical-origin enforcement and Supabase confirmation callback setup. Added VERCEL_DEPLOYMENT.md and .vercelignore; deployment artifacts and .env remain excluded. No application logic, remote settings or hosted data changed, and no next-phase work started. Existing application verification remains applicable; hosting and real email checks must be run against the deployed URL.

## Phase 1 authentication deployment fix

User reported the generic authentication form error while deploying to Vercel. Inspection showed that configuration exceptions and unexpected failures were incorrectly reported as credential/input errors. Added typed configuration failures, safe field-specific messages, validated origin configuration, structured redacted server diagnostics and stable response codes. Validated authentication request data before making provider requests. No database migration, design change or next-phase feature is involved.

Verification: 31 tests passed, TypeScript passed, production build passed. A compiled-app test with missing provider variables passed: HTTP 503 / AUTH_CONFIGURATION, with no credential disclosure. Final browser regression, zero-warning lint and format checks all passed. The actual deployed cause remains unconfirmed because no deployment URL or server response beyond the original message was supplied; no Vercel environment values were accessed or changed.

## Typography update within Phase 1

User selected Google Fonts Syne and Figtree. Applied Syne to headings, brand and prominent numeric scores; Figtree to body text, navigation and inherited controls. Added Google Fonts stylesheet import with display=swap, limited requested weights, preconnect hints and system fallback stacks. External fonts load in the browser; application builds do not require downloading font binaries. Existing colors, layout, workflows and phase boundaries are preserved. Google font hosts are blocked by EACCES in the agent environment, so live font download must be checked on the deployed site. Lint and production build (including TypeScript) passed.

## Phase 1 authentication rate-limit handling

User reported the generic HTTP 429 message. Confirmed the Supabase adapter discarded provider error codes and Retry-After. Added allowlisted classification of email limits versus general authentication limits, preserved valid upstream retry guidance in the API response/header, and kept provider payload details redacted. The form prevents duplicate in-flight submissions, honors retry cooldowns without automatic retries, and shares a 60-second email cooldown after accepted signup/resend. An email-specific limit does not disable existing-code verification or sign-in. When no retry header exists, the UI's default cooldown is not presented as proof that the provider quota has reset. Non-authentication API rate limits retain their generic request wording.

Verification: 36 tests passed; production build/TypeScript and zero-warning lint/format checks passed. Browser regression passed, including HTTP 429 classification/Retry-After preservation, visible email cooldown, disabled duplicate submits, no automatic signup retry and the full shared-core workflow. No provider limits, Supabase settings, migrations or future-phase features changed. The actual deployed request/error subtype is not confirmed without the deployment details or Supabase Auth log code.

## Phase 2 - explicitly approved

The user approved Phase 2 after reviewing its real-estate/forms scope. Preserve all Phase 1 workflows, Supabase RLS/session controls, rate-limit handling, Syne/Figtree typography, navy/teal styling and Vercel deployment behavior. Stop before Phase 3. Earlier hosted acceptance and email-provider setup remain external dependencies; this approval does not claim those checks passed.

### Phase 2 implementation order and acceptance

1. Add an additive versioned real-estate schema: owned properties/contacts, source/license provenance, bounded transactional import runs and per-record deduplication, claim/evidence review, developer preferences, partner templates/forms/reviews and immutable delivery/outreach history.
2. Provide a 40-record clearly fictitious vacant-lot CSV. Reimporting the same data must create no duplicate properties and must preserve reviewed evidence when nothing changed. Changed property facts invalidate relevant claim/form approvals.
3. Add property create/edit/search/detail UI, CSV upload/preview/import history, private property evidence uploads and claim review with honest UNVERIFIED defaults.
4. Add owner contacts/permission evidence/manual outreach logs and deterministic developer matching with explanations; no scraper or automated cold send.
5. Add per-partner template mapping/prefill, editable draft forms, submission for independent administrator review, version-bound approval and immutable simulated-send events. Database/server guards must reject sending before approval and stale/edited approvals, including direct API attempts.
6. Use typed BLOCKED licensed-feed/live-delivery adapters and an explicitly DEMO partner delivery path while contracts, authorized domains and provider credentials are unavailable. Simulation must never report live delivery.
7. Verify domain validation/scoring, actual SQL/RLS/approval gates, the Phase 2 browser journey and preserved Phase 1 flows; run lint, typecheck, formatting and build. Update setup/README/checklists with actual results and external blockers.

### Phase 2 decisions

- Supabase-native, personal-owner scoped; ADMIN/SUPER_ADMIN review authority is explicit. A second administrator reviews property claims/forms; an owner cannot approve their own submission.
- Property document bucket is private with session-scoped upload/read policies, strict size/type/magic checks and short-lived signed download URLs. No public document URLs or ID-photo uploads. Scanning is marked unavailable rather than claimed.
- CSV imports are bounded and transactional within a server request, with persisted source/license, row dispositions, status and timestamps; no unimplemented background worker is claimed.
- Source/claim values remain unverified until an authorized review backed by evidence. Demo evidence cannot verify a real property. Property edits and partner preference changes invalidate pending approval snapshots.
- No production migrations or external messages are authorized by implementation. Hosted setup instructions will be concrete; the publishable key cannot apply schema/storage policies.

## Pause checkpoint - user requested stop

Phase 2 work is paused at the user's explicit request; resume this approved phase when the user returns. Do not start Phase 3 or repeat Phase 1 implementation.

Completed in this Phase 2 session:
- Inspected the existing shared core and updated the Phase 2 plan and approval boundary.
- Added draft migrations 202611100003_real_estate.sql, 202611100004_property_workflows.sql and 202611100005_property_evidence.sql.
- Verified all five migrations apply successfully to isolated PGlite PostgreSQL using tests/fixtures/database.mjs. This is a schema-application smoke check only, not full behavior/security verification.
- Added initial real-estate schemas/types/developer scoring, CSV parser/import validation, evidence file validation, BLOCKED property-feed interface, DEMO partner-delivery interface and the 40-record fictitious CSV under public/examples.

Unfinished / must verify before completion:
- The new API routes, property/evidence Storage integration, UI/screens and navigation have not been implemented yet.
- The Phase 2 approval/RLS/import behavior tests and browser workflow have not been written/run. Existing Phase 1 tests have not been rerun after these draft additions.
- Format/lint/typecheck/build of Phase 2 additions are pending. Treat all new Phase 2 files as work in progress.
- Review the partner-template JSON mapping guard and all claim/form approval transitions with direct database negative tests. Review locking order in simulated delivery (form/property/partner) to avoid deadlocks under concurrent changes.
- Wire tests/fixtures/database.mjs into the HTTP fixture, add Phase 2 RPC and Storage contracts, and preserve the existing Phase 1 browser test.
- Document ordered hosted migrations/private bucket setup after implementation; no remote Supabase schema/storage changes or external sends have occurred.

Next action on resume: inspect these draft files and implement/test Phase 2 database behavior before wiring the APIs and UI. Keep existing Syne/Figtree typography, authentication, consent and rate-limit handling unchanged. Do not declare Phase 2 complete or start Phase 3.

## Signup authentication diagnostics
User reported the generic authentication failure during signup. Replaced discarded Auth provider errors with allowlisted safe messages for SMTP recipient restrictions, disabled email/signup, password policy, CAPTCHA, credentials and confirmation errors. Unknown provider payloads remain redacted; upstream server failures return 503. No hosted settings or schema changed. Verified 38 tests and TypeScript; live signup cause remains unconfirmed until deployed response or Supabase Auth logs are available.

## Phase 2 delivery checkpoint - resumed and locally verified

The user resumed Phase 2 and then supplied the local Netcozy Connect.html design reference after the Claude artifact URL returned a security verification page. Inspected its rendered dashboard/marketplace and design tokens. Applied the navy #14213D sidebar, teal #0E7F84 actions/#19A7AD accents, #F7F9FC background, white rounded cards, line icons, compact filters, property gallery and dashboard hierarchy. Preserved the selected Syne/Figtree typography. Adapted landing/auth surfaces and existing shared-core screens without adding the reference's future modules or fabricated live metrics.

Implemented /properties navigation, property create/edit/search/pagination/details, CSV upload/preview/import history with per-run dispositions, private evidence upload/download, independent claim review, contacts/permission withdrawal/manual outreach history, developer preferences and explained deterministic matches, partner template mapping/versioning, editable forms, independent version-bound review and immutable DEMO simulation receipts. Server routes use the signed-in Supabase session and same-origin mutation checks. Uploads bound the multipart body before parsing, validate size/MIME/magic bytes, record SHA-256, forbid overwrite and use 60-second signed download URLs. Malware scanning remains explicitly unavailable. No ID-photo workflow exists.

Corrected draft SQL defects found by real behavior tests: ambiguous import disposition/outreach channel variables, null template mapping values, address verification including region/postal facts, required hashes for uploaded evidence, and simulated delivery's locking order (property -> partner -> form). Unchanged reimports preserve reviewed evidence; changed facts or partner preferences invalidate unsent approvals. Real records cannot use demo evidence or the demo delivery path even after independent approval. Licensed-feed/live-delivery adapters remain typed BLOCKED. Review/outreach/permission/delivery histories have no user update/delete grants; shared-core immutable audit records Phase 2 mutations.

Verification on the delivered implementation:
- npm.cmd test: 53 passed, 0 failed. Includes real disposable PGlite PostgreSQL migration/RLS/import/review/consent/Storage-policy tests, deterministic scoring and provider/input checks.
- npm.cmd run lint: passed, zero warnings.
- npm.cmd run typecheck: passed; final production build also passed TypeScript after the last API updates.
- npm.cmd run format:check: passed.
- npm.cmd run build: passed, including both new API routes.
- npm.cmd run test:browser: Phase 1 regression passed against the fixture applying all five migrations.
- npm.cmd run test:phase2-browser: passed through import/preview/reimport, per-run row dispositions, search/pagination, private PDF upload/signed download, two-user isolation, independent claim/form reviews, form-edit invalidation, direct API bypass rejection, contact permission/manual logging/withdrawal, DEMO receipt and mobile overflow checks.
- Inspected desktop dashboard, property gallery and desktop/mobile form screenshots against the supplied HTML. Temporary reference files/screenshots are ignored under .npm-cache. External fonts still require normal browser connectivity; no live font-download acceptance is claimed.

These browser checks use actual Next.js routes and SQL/RLS with explicitly simulated Supabase Auth/Storage HTTP contracts. They do not verify hosted email, hosted Storage metadata/policies, signed-URL expiry enforcement or concurrent hosted transactions. SUPABASE_SETUP.md now documents all five ordered migrations, private bucket policies, independently applied draft reconciliation and the two-account hosted acceptance sequence. README, checklist and Vercel instructions reflect the approved Phase 2 scope.

No remote schema, bucket, Auth settings, deployment or external message was changed. Owner-authorized development migration application (003-005 if Phase 1 is already installed), actual email confirmation/sign-in, private Storage and two-account hosted acceptance remain open. Phase 2 code/local verification are delivered; Phase 2 is not declared fully accepted while those hosted checks remain pending. No Phase 3 work was started.

## Email verification code update - 2026-11-11

User reported successful application of Phase 2 migrations 003-005 (user confirmation, not independently queried); hosted end-to-end acceptance remains pending. User then requested emailed verification codes instead of confirmation links. Signup now opens a focused code form with the submitted email prefilled and hides the password/signup form after acceptance. Login retains a code/resend option for unconfirmed accounts. Code input supports one-time-code autofill and 6-10 numeric digits. Successful verification uses Supabase's email OTP type and server-held HTTP-only cookies. Wrong/expired codes retain the form with a safe error; resend/duplicate-submit/provider cooldown behavior is preserved, and an email-only cooldown does not block code verification. Supabase still generates/expires/verifies codes; no custom OTP storage or cryptography was added.

Added supabase/templates/confirmation.html and updated setup/deployment/README instructions for the required code-only Confirm signup email template using {{ .Token }}. The owner must save that template in Supabase and deploy the app changes; no remote email template/settings or schema was changed by this work. Existing callback route remains for previously issued links; the new email template contains no links.

Verification: production build including TypeScript passed; zero-warning lint and formatting passed; 53 automated tests passed. Updated Phase 1 browser regression passed, covering automatic code step, prefilled email, resend cooldown with verification enabled, incorrect-code rejection and successful verification/dashboard navigation. Phase 2 browser regression also passed. Auth/email delivery remains simulated in local tests; actual code delivery and hosted entry must be exercised after the template is saved. No further phase work was started.

## Branded workspace loading - 2026-11-11

Replaced plain route/workspace/property loading messages with a shared navy/teal constellation loader: Netcozy monogram, floating connection icons, subtle orbit/connection animation, animated dots and decorative shimmer cards. No artificial progress or delays. Status text is accessible; decorative content is hidden from assistive technology, and reduced-motion disables animations. Verified production build/TypeScript, zero-warning lint and browser desktop/mobile previews, no mobile overflow and reduced-motion computed styles. Preview screenshots are ignored under .npm-cache. No authentication, data or phase-scope changes.
