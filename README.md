# Netcozy Connect

Phase 1 shared-core implementation: Next.js App Router, React, TypeScript, Zod and Supabase Auth/PostgreSQL. Supabase replaces the original Prisma recommendation. Only the shared core is included; Phase 2 and later are not started.

## Run locally

1. Install Node.js 24 LTS (the recorded environment is 24.20.0).
2. Run `npm.cmd ci` (or `npm ci` outside PowerShell). Use npm.cmd if Windows execution policy blocks npm.ps1. A portable package-lock.json is included.
3. Keep your configured `.env`. For a new checkout copy `.env.example` to `.env`, fill in your development Supabase URL/publishable key, and set APP_BASE_URL to the browser origin you use.
4. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md): apply the two reviewed development migrations, enable email confirmation and configure the confirmation template. A publishable API key cannot apply SQL migrations.
5. Run `npm.cmd run db:check` for a read-only API reachability check.
6. Run `npm.cmd run dev` and visit http://localhost:3000. Sign up with your own email, confirm the email, sign in, complete the explicitly labelled demo identity step, and save a profile and goal.
7. For a compiled application run `npm.cmd run build`, then `npm.cmd start`. Production hosting must use HTTPS. No production deployment is included here.

## Included workflows

- Email/password signup, confirmation link/code, resend, sign-in, session refresh and sign-out through Supabase Auth. Password cryptography is entirely handled by Supabase.
- Server-held HTTP-only session cookies (Secure in production, SameSite=Lax), provider user validation on private requests, same-origin mutation checks, Zod validation, RLS and controlled role assignment.
- Guided industry/intent, demo identity, editable profile and atomic first-goal onboarding. Add, edit, pause and reactivate multiple personal goal profiles.
- Explainable deterministic matches, approved admin-configured weights, region/industry filters, saved searches and save/dismiss feedback. Scores recompute on workspace reads using current goals, weights and closed pipeline outcomes; there is no background email/job scheduler.
- Immutable approved template versions, personalized editable drafts, explicit review and reviewed-message copying. Edits invalidate review in the database. All directory entries are fictitious and have no external profiles; real LinkedIn import/sending is unavailable.
- Personal/B2B/recruitment pipelines with board and card-table views, stages, notes and manual simulated-outcome recording. Advanced stages require matching consent and a reviewed draft in server and database checks. No real messages are sent by this application.
- Append-only consent evidence/revocation, channel preferences, activity history, and export/deletion requests for administrative review. Submitting a request does not automatically export or delete the account.
- Admin member/role overview, honest demo identity review, immutable template versions/previews, matching weights, privacy-request queue, provider status and redacted audit events/CSV. Super-admin bootstrap is operator managed; ordinary members cannot assign roles.

## Database and security

Migrations live in `supabase/migrations`. They create nc_-prefixed tables and the nc_private helper schema; they do not reset existing data. They add an Auth user trigger and backfill missing Netcozy member/profile records for existing Auth users. Review the impact before applying to an existing project. No application data or migration has been applied remotely by this agent.

Every application table has RLS; anonymous access is revoked. Private records are owned by auth.uid(). ADMIN/SUPER_ADMIN access is explicitly limited to the core review tables. Other roles are recognized but do not grant early access to future domain modules. This phase is personal-account scoped; organization collaboration is not implemented. No document uploads, ID photographs, payment details or actual contact sharing are included.

Server code uses documented Supabase Auth/PostgREST HTTP APIs and built-in fetch, without a service-role key. Browser JavaScript never receives provider access/refresh tokens. Queries use the signed-in user's provider token, so database RLS still applies. Provider failures are redacted and fail closed. See [CONTRIBUTING.md](CONTRIBUTING.md) for coding/security rules.

## Verification

- `npm.cmd run lint`: ESLint with zero warnings.
- `npm.cmd run typecheck`: strict TypeScript.
- `npm.cmd test`: configuration, scoring, consent and actual SQL/RLS tests on disposable PGlite PostgreSQL. No live Supabase account is used.
- `npm.cmd run build`: production compilation.
- `npm.cmd run test:browser`: starts the compiled app and runs installed Chrome through signup/confirmation, onboarding, matching, outreach, pipeline, consent withdrawal, blocked actions, admin templates, mobile layout and logout. Uses a clearly test-only local Supabase HTTP fixture with simulated Auth and a real disposable PostgreSQL engine. Requires an installed Chrome browser and a successful build. This is not a live Supabase Auth/email test. The fixture and app bind only to 127.0.0.1 on ports 4874 and 3100.
- `npm.cmd run format:check`: formatting.
- `npm.cmd run db:check`: real API reachability only; does not query rows or prove schema/RLS/migrations.
- `npm.cmd audit`: needs registry access; it is blocked in the current agent environment and is not reported as passing.

Actual results and outstanding hosted verification are tracked in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md).

## Provider status and boundaries

Supabase API reachability was verified by the user. Local application/SQL integration tests use the test fixture; hosted migrations, real email delivery and live end-to-end acceptance remain pending. Identity is DEMO (never a real verification); LinkedIn OAuth/import, external email campaigns, SMS/WhatsApp, payments, licensed datasets and AI media providers are BLOCKED/unimplemented. No service pretends to be live. Production hardening and marketplace modules remain later-phase work.

References: [Supabase Auth HTTP API](https://supabase.github.io/auth/), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SQL migrations](https://supabase.com/docs/guides/local-development/database-migrations).
