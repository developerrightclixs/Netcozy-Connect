# Phase 4: LI3K Studio and operational readiness

Phase 4 is approved. The local implementation supports manual onboarding, demo text preparation, private uploaded images, creative review, manual export, calendar planning and aggregate reporting. AI generation, video rendering, social publishing, connected analytics and subscription billing are not live. Production acceptance is a separate hosted exercise.

## Database setup

Use the existing authorized development Supabase project. Review the SQL and take a recoverable backup before applying changes. Apply only missing migrations in order; never rerun existing table-creation migrations or reset the database.

Prerequisites: migrations 001–008, Supabase Auth/Storage schemas and existing admin bootstrap. If 006–008 have not been installed, follow PHASE3_SETUP.md first.

1. `supabase/migrations/202611120009_studio.sql`
2. `supabase/migrations/202611120010_studio_assets.sql`

009 adds six studio tables, owner/admin read policies, append-only review/export/usage/report records and a controlled mutation RPC. Brand updates lock before creative updates; review/export use the same ordering and reject stale revisions. Brand changes invalidate all linked approvals. Creative edits and image attachments reset review. Members cannot directly insert, update or delete studio tables or assign approval.

010 adds a private `netcozy-studio-assets` bucket, immutable media metadata and attachment RPC. Bucket settings: private, maximum 2 MB, PNG/JPEG only. Existing permissive bucket settings cause the migration to fail for review. Policies allow an owner to upload only to their registered pending object; owners/admins can read authorized objects. No overwrite/delete policy is added. Audit other existing Storage policies: permissive policies combine with OR and must not independently expose this bucket.

Uploads validate MIME/signature/size at the application boundary and compare registered metadata on completion. SHA-256 records the application-received bytes. This does not constitute malware scanning, image decoding or independent ownership verification. Files are labelled `UPLOADED_UNSCANNED`. No SVG, PDF, executable or video upload is accepted by Studio. Failed/pending objects need an operator cleanup policy after checking references; automatic deletion is not implemented.

No new environment variables, service-role key or runtime dependencies are needed. Preserve the configured `.env`; never expose keys in screenshots or logs. `.env.example` lists only variables actually consumed by the application. A scoped development-tooling minimatch override and lockfile update address the advisory described in CONTRIBUTING.md.

## Hosted acceptance walkthrough

Use three real, confirmed development accounts: member/owner A, independently authorized administrator B and ordinary member C. Do not use fictitious Auth accounts in the hosted project. Existing demo identity is still only a demonstration.

1. Open **LI3K Studio** (`/li3k-studio`) as A. Save authorized business details and a brand color. Website URLs are stored as HTTPS references, never fetched or scraped. Confirm owner C cannot read A's studio data through UI or direct REST/RPC requests.
2. Prepare a DEMO text/image/video brief. Verify it contains editable text/storyboard only, shows the source and records zero provider API calls. Create a manual draft and a planned local date/time. Confirm the calendar displays the intended time in another timezone. Nothing is automatically published.
3. Upload an authorized PNG/JPEG under 2 MB. Reject spoofed MIME/signatures, oversized requests, missing rights acknowledgement and other types. Confirm the bucket is private, C cannot read/register into A's paths, overwriting is denied and the signed download expires after 60 seconds. Test the actual hosted Storage service; fixture checks do not prove hosted expiry or bucket configuration.
4. Attach the uploaded image to an image/video brief. It is an image attachment/poster, not a rendered video. Submit the current creative revision. A cannot self-approve even if A is also an admin. C cannot approve. B can review text, script, audience and image/rights notes, then approve or reject with a note.
5. Export only after current independent approval. Repeat export: one immutable package per revision. The JSON package contains the brand/creative snapshot and attached asset reference. Retrieve the private image separately using the library link. No expiring link is embedded in the package. This records export, not proof of download completion, external publication or delivery.
6. Edit the caption, change brand details or attach another image. Confirm approval resets and stale review/export requests fail. Save a revised draft before resubmitting after a brand change/rejection. Old exported snapshots must stay unchanged. Removing B's ADMIN role must immediately block further review.
7. After manual publication, record aggregate metrics with a nonfuture date range and source note. Reports are owner-supplied, immutable and labelled `MANUAL_UNVERIFIED`. Same-period duplicates are rejected; identical request-key replay returns the original record. Overlapping periods may exist and are intentionally not summed. No per-person analytics, provider synchronization or source verification is claimed.
8. Check desktop/mobile views, keyboard focus, empty/error states and logout. Recent panels are bounded to 100 records, not complete totals or an unlimited archive.
9. As B, open Administration → Operational readiness. Confirm tables are reachable. Ordinary users must receive 403 from `/api/operations`. `/api/health` is anonymous liveness only and must expose no secrets/configuration. Read reachability is not migration or RLS certification.

## Local checks

After installation, run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run format:check`, and `npm.cmd run build`. Then run `npm.cmd run test:phase4-browser` and the Phase 1/2/3 browser regressions. Browser tests use installed Chrome, simulated Supabase Auth/Storage HTTP contracts and actual disposable PostgreSQL/RLS. Phase 4 binds only to `127.0.0.1`, ports 3104/4878. It never uses the configured hosted project.

Run `npm.cmd audit` with registry access. Store actual results in IMPLEMENTATION_PLAN.md. Passing local tests does not close hosted acceptance.

## Live-provider enablement requirements

The Studio provider panel is the source of truth: demo preparation is `DEMO`; AI text/media, live publishing and connected analytics are `BLOCKED`. Presence of an arbitrary environment key must not silently mark a provider verified.

For each future provider, record the selected service/account owner, approved capabilities, credential secret-store references, data retention/region, sandbox account, spend limits, authorized accounts/scopes, webhook verification, retry/idempotency and failure reconciliation. Implement and test the actual adapter before switching to CONFIGURED; perform a bounded real acceptance exercise before VERIFIED. Never send client secrets through chat, commit them or use browser-exposed secrets.

- AI text/images/video: approved provider and budget; private asset delivery; truthful usage/cost provenance; cancellation and timeouts; asynchronous job/status reconciliation where required. Current demo preparation must remain separate from billable calls.
- Social publishing: official API permissions and authenticated client-owned account; channel-specific payload validation and review; durable jobs; safe duplicate prevention and revoked-credential behavior. No social scraping or automatic personal DMs. Current JSON export is manual publication assistance.
- Analytics: actual supported aggregate fields and source timestamps; no invented social opens or per-person tracking. Manual snapshots must remain visibly separate from verified provider imports.
- Commercial plans: client-approved terms, usage limits and rates before enabling subscriptions or presenting live prices. No proposal prices are treated as current rates. No billing provider, charge/refund or paid subscription exists in this slice.

## Production operations runbook

Before launch, assign an operational owner and incident contact. Record the production host, Supabase project, deployed commit/migration identifiers and rollback release. Use an isolated development project for acceptance. Preserve existing data; do not treat a rollback deployment as permission to drop additive tables.

### Deployment and monitoring

- Run local checks and hosted acceptance on the exact release. Configure the canonical HTTPS APP_BASE_URL, Supabase Auth allowed origins/redirects and email-code template. Confirm actual signup, confirmation, refresh and logout across browsers.
- Deploy a preview first, inspect migrations in order, then promote the tested release through the approved hosting process. Verify the configured host and HTTPS before routing users. No deployment is performed by these source changes.
- Monitor `/api/health` externally for process availability. Use admin readiness for manual diagnosis, not a public authenticated monitoring credential. Add real alert routing for sustained failures, redacted server errors, Auth email delivery, Storage failures, database capacity and provider webhook backlog as integrations are enabled. External monitoring/alerts are not provisioned here.
- Baseline headers include no-sniff, frame denial, referrer policy, disabled unused permissions, production HSTS and limited CSP directives for object embedding, framing, base URLs and form destinations. This is not a full nonce-based script policy. Validate a complete CSP with Next.js hydration, fonts and private-media origins before tightening script/style/connect directives. Do not enable unsafe HTML rendering.
- Existing Supabase Auth quota feedback is preserved. Distributed application-wide abuse/rate controls, bot challenge policy, security review, log retention and alert thresholds still need hosted configuration and validation. The 32 KB Studio JSON bound and 2 MB image limit are not substitutes for rate limiting.

### Backup and restore acceptance

1. Set and approve recovery point/time objectives and backup retention; record the project/account owner and exact provider capabilities for the purchased plan. Do not assume backups or point-in-time recovery are enabled.
2. Back up PostgreSQL using the authorized operational tooling and securely protect the backup. Inventory private Storage objects and metadata separately: a database backup alone does not prove file-byte recovery. Also document Auth configuration/email templates, migration history and secret-store references without copying secrets into this repository.
3. Restore into an isolated recovery project, never over the live environment for a drill. Reconcile migration versions and restore object bytes before testing signed access. Check row counts, ownership, RLS, admin role bootstrap, immutable exports/reviews, media references and real confirmation emails without sending campaigns or charging money.
4. Record start/end time, recovery point and any missing data. Run the hosted three-account workflow and confirm A/C isolation, revoked permissions, exports and private images. Document how sessions and provider credentials are re-established or revoked after recovery.
5. Keep restore evidence and the operator sign-off. No backup or successful restore is claimed until the actual infrastructure drill is recorded.

### Incident response

Disable affected provider capability first, preserve redacted request/audit evidence, revoke compromised credentials through the provider and secret store, and stop queued external actions before replay. Diagnose schema/configuration issues using admin readiness without printing provider payloads or user documents. Revert application release if appropriate, preserve additive data, and re-run hosted acceptance before re-enabling affected workflows. Follow client incident and privacy procedures.

Phase 4 is not fully production-accepted until provider implementation/acceptance, hosted testing, monitoring, distributed abuse controls, security review and backup/restore evidence are complete.
