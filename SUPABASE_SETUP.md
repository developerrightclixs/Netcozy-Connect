# Supabase development setup for Phase 1

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

Each file is transactional. Review errors and stop on failure. No rows should be copied from a production project for testing. If you use an established Supabase CLI workflow, apply the files through its migration tooling and keep that migration history authoritative; do not run the same files independently in both places.

## 3. Configure Auth

- Enable email/password sign-in and **Confirm email** in Supabase Auth. The application rejects signup/password login when mailer_autoconfirm is enabled.
- Set the development Site URL to the exact browser origin, such as `http://localhost:3000`. Match APP_BASE_URL in .env. Use your final HTTPS origin when deploying later.
- For Confirm signup, use this link in the Supabase email template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

- Optionally include `{{ .Token }}` in the email for the app's confirmation-code form.
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

The automated local tests exercise these application/database boundaries with simulated Auth; they do not replace hosted Supabase verification. Identity verification is still explicitly DEMO, no photos are uploaded, and no social/SMS/WhatsApp/email campaign is sent. Stop before Phase 2.
