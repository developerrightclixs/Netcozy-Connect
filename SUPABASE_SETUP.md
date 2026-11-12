# Supabase development setup for Phases 1-4

Phase 4 adds migrations 009 and 010 after the existing 001-008. Follow [PHASE4_SETUP.md](PHASE4_SETUP.md) for the private Studio bucket, independent review and hosted three-account acceptance. Never rerun already applied migrations. Live AI generation, publishing and billing remain unavailable.

The URL and publishable key in .env support normal Auth/data access. They intentionally cannot create tables or assign initial administrators. Use the Supabase project's SQL Editor as the authorized project operator, or your existing authorized Supabase CLI migration workflow. Do not paste credentials into chat or use a production project for development testing.

## 1. Review existing state

Run this read-only query first:

```sql
select schemaname, tablename
from pg_tables
where schemaname = 'public' and tablename like 'nc_%';
```

If any of these tables already exist, check the project's migration history before applying files. The files use transactional CREATE statements and are not designed to be rerun over an existing installation. Do not drop/reset existing objects to make them pass. If the project already has a different Netcozy schema, reconcile it with a new migration after reviewing the impact.

The first migration creates nc_-prefixed application tables, private helpers, access policies, audit triggers and a new-user Auth trigger. It also creates missing Netcozy profiles/MEMBER roles for existing Auth users without changing their Auth records. The second inserts twelve explicitly fictitious demo directory entries. It creates no fake Auth users, public contact details or actual consents for real people.

## 2. Apply the prepared migrations in order

In the **development** project's SQL Editor run the exact contents of:

1. `supabase/migrations/202611100001_shared_core.sql`
2. `supabase/migrations/202611100002_demo_directory.sql`
3. `supabase/migrations/202611100003_real_estate.sql`
4. `supabase/migrations/202611100004_property_workflows.sql`
5. `supabase/migrations/202611100005_property_evidence.sql`
6. `supabase/migrations/202611110006_marketplace.sql`
7. `supabase/migrations/202611110007_module_workflows.sql`
8. `supabase/migrations/202611110008_event_ticketing.sql`

Each file is transactional. Review errors and stop on failure. No rows should be copied from a production project for testing. If you use an established Supabase CLI workflow, apply the files through its migration tooling and keep that migration history authoritative; do not run the same files independently in both places.

The user reported successful application of 003-005. For that existing project, review/apply only the NEW Phase 3 files 006, 007, 008 in order. Do not rerun earlier files or edit an applied migration. Each Phase 3 file checks prerequisite objects before creating dependent functions. See [PHASE3_SETUP.md](PHASE3_SETUP.md) for role mapping and hosted acceptance. Earlier hosted functionality remains unverified until exercised with actual accounts.

If Phase 1 migrations are already applied, apply only 003–005 after reviewing migration history. The three Phase 2 files were drafts at the pause checkpoint and have since been corrected during local SQL verification. No remote application of them has been performed by this agent. If you independently applied an earlier draft, stop and reconcile its differences through a new additive migration; do not rerun or edit an applied migration.

Migration 005 requires Supabase Storage's existing `storage.buckets`/`storage.objects` schema. It creates the private `netcozy-property-evidence` bucket (2,097,152-byte limit; PDF, PNG, JPEG only) and session-scoped INSERT/SELECT policies. Existing unsafe bucket settings cause the migration to stop. Do not make this bucket public or add overwrite/delete policies. Review other existing Storage policies: permissive policies combine with OR and may broaden these access boundaries. Use the Storage API for uploads; do not manipulate real Storage object rows through SQL. Local tests use a minimal Storage schema and do not prove hosted Storage behavior.

## 3. Configure Auth

- Enable email/password sign-in and **Confirm email** in Supabase Auth. The application rejects signup/password login when mailer_autoconfirm is enabled.
- Set the development Site URL to the exact browser origin, such as `http://localhost:3000`. Match APP_BASE_URL in .env. Use your final HTTPS origin when deploying later.
- In Authentication > Email Templates > Confirm signup, replace the email body with the code-only template below (also saved in `supabase/templates/confirmation.html`). Keep email confirmation enabled. Suggested subject: `Your Netcozy Connect verification code`.

```html
<h2>Verify your Netcozy Connect email</h2>
<p>Enter this verification code in Netcozy Connect:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>If you did not create an account, you can ignore this email. Do not share this code.</p>
```

- `{{ .Token }}` is required. Remove confirmation-link buttons/URLs from this template. Supabase generates, expires and verifies the code; the app does not generate or store OTPs. Signup opens the code form with the email filled in. Successful verification sets HTTP-only session cookies and opens the dashboard. Resend uses the same Confirm signup template and retains existing provider limits/cooldowns.
- Supabase email delivery must be configured for your intended users. Built-in email limits/provider restrictions and SMTP setup are external dependencies. Resend does not claim delivery; the UI reports only that an eligible request was accepted.

## 4. Bootstrap an administrator

First sign up and confirm the intended administrator account normally. Then, as the authorized SQL Editor operator, replace the placeholder email below with that account's email:

```sql
insert into public.nc_roles(user_id, role)
select id, 'SUPER_ADMIN'
from auth.users
where email = 'your-confirmed-admin@example.com'
  and email_confirmed_at is not null
on conflict do nothing;
```

This is the one operator-managed bootstrap step. Do not grant it to every member. Refresh the app to see Administration. A super-admin can assign/remove ordinary platform roles through the app. Creating/removing SUPER_ADMIN remains operator-managed to avoid accidental lockout or self-escalation.

## 5. Hosted acceptance checks still required

- Sign up with an email you control, confirm the actual received email, sign in and verify sign-out.
- Complete demo onboarding, see the fictitious matches, create/edit/review a draft and track it in a pipeline.
- Change a reviewed draft and confirm its review is cleared. Withdraw matching consent and verify matches disappear and advanced pipeline stages are blocked.
- Use two separate accounts/browser sessions to confirm private profiles, goals, drafts, consents and leads remain isolated. Do not use a service-role key for this check.
- Sign in as the bootstrapped administrator and exercise role/template/rules/privacy-request review.

The automated local tests exercise these application/database boundaries with simulated Auth; they do not replace hosted Supabase verification. Identity verification is explicitly DEMO, no ID photos are collected, and no social/SMS/WhatsApp/email campaign is sent. Phase 2 property evidence can include private documents. Stop before Phase 3.

## Phase 2 hosted acceptance (still required)

1. Configure the actual HTTPS Site URL and code-only Confirm signup template above. Create an account, enter the emailed code in the app, then verify sign-out and password sign-in. Check wrong/expired code rejection and resend. This flow should not navigate through an email link or expose session tokens in a URL.
2. Use two separate accounts you control. Bootstrap an ADMIN for the independent reviewer using the existing operator-managed role procedure. The property owner must not approve their own claim or form, even if they also hold ADMIN.
3. In Properties & forms > Imports, download the 40-record fictitious CSV, preview it, attest its demo source/license and import it. Reimport: expect no new properties and unchanged dispositions. Review source/license and timestamps in import history.
4. Open a property, add demo evidence, request a claim review, and review from the second account. Ordinary users must not read each other's properties/documents; an authorized reviewer can inspect evidence. DEMO review never verifies a real property.
5. Upload a harmless test PDF/PNG/JPEG through the app. Verify the bucket is private, MIME/signature/size checks reject invalid files, metadata becomes UPLOADED_UNSCANNED, and download URLs expire after 60 seconds. No scanner is configured. Do not upload ID photographs or sensitive real documents during acceptance.
6. Load demo developers; create a form using the approved demo template. Sending/simulation before independent approval must fail, including direct API requests. Submit, review with the second account, then edit the form or change property facts/preferences: the previous approval must become unusable. Regenerate and review the new version.
7. Simulate approved delivery: expect one DEMO/SIMULATED_SENT receipt, no actual email, and immutable review/delivery history. Real property/partner delivery must remain blocked. Withdraw matching consent and verify creation/progression is blocked.
8. Save a demo contact, record permission, add a manual log, withdraw permission and verify new non-note logs are rejected. A changed contact requires fresh permission. Confirm the shared-core activity/admin audit records Phase 2 mutations.

Passing local PGlite and HTTP-fixture tests does not satisfy these hosted checks. No production migration, remote settings change or outbound message is authorized or performed by the implementation work.
