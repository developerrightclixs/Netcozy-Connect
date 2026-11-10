# Vercel deployment - Phase 1

The Next.js app can use Vercel's framework defaults; no custom vercel.json or static export is required. The current preview includes the approved Phase 1 shared core and Phase 2 property/forms workflows. Phase 3 is outside scope. No deployment has been performed by the agent.

## Project settings

- Framework: Next.js.
- Root directory: the directory containing package.json (repository root for this project).
- Node.js: 24.x, matching package.json.
- Install: npm ci.
- Build: npm run build.
- Output directory: leave the Next.js default.
- Deploy the source and package-lock.json; do not upload .env, node_modules, .next or .npm-cache. .vercelignore explicitly excludes local artifacts for CLI deployments. Git deployments also rely on .gitignore.

## Vercel environment variables

Add these under Project Settings > Environment Variables for the deployment environment you are using:

| Name | Value |
| --- | --- |
| SUPABASE_URL | Your Supabase project URL, identical to the working local value |
| SUPABASE_PUBLISHABLE_KEY | Your sb_publishable_ key, identical to the working local value |
| APP_BASE_URL | Exact live HTTPS browser origin, such as https://netcozy-connect.vercel.app |

Use the actual assigned project domain or custom domain, not the sample value. Do not include a path. APP_BASE_URL controls server origin validation, so localhost or a different Vercel domain will cause POST requests to fail. Vercel does not obtain your ignored local .env from Git. Redeploy after changing environment variables.

A Preview deployment is a different origin. Configure APP_BASE_URL for that Preview origin separately, or leave it unset for that environment to use the request origin. Signup uses emailed verification codes entered in the app. Use a separate Supabase development project for isolated preview Auth testing.

## Supabase configuration

Follow SUPABASE_SETUP.md to review/apply the five ordered migrations, skipping any already applied. Phase 2 requires migrations 003–005 and the private evidence bucket/policies. Vercel deployment does not apply them automatically. Never rerun or reset an existing schema blindly.

Under Supabase Authentication URL Configuration, set Site URL to the exact live HTTPS origin. Keep email confirmation enabled. Replace the Confirm signup email body with `supabase/templates/confirmation.html`, containing:

```html
<h2>Verify your Netcozy Connect email</h2>
<p>Enter this verification code in Netcozy Connect:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>If you did not create an account, you can ignore this email. Do not share this code.</p>
```

Remove email confirmation-link buttons/URLs from this template. Suggested subject: `Your Netcozy Connect verification code`. This dashboard template change is required independently of deploying the app. No SQL migration is needed. Keep only necessary trusted URLs in the redirect allowlist; code entry does not require a redirect from email.

## After deployment

Open the canonical HTTPS domain and verify signup, the actual emailed code, code verification, login, onboarding and match discovery. Test consent withdrawal and two-account data isolation. Follow SUPABASE_SETUP.md to bootstrap the intended admin account if needed. Check Vercel build/function logs when a step fails, without copying codes or session tokens into chat.

The app still displays Phase 1/demo notices and disables indexing through its development metadata. Hosted acceptance, real identity verification and external sending are not claimed complete by publishing a URL.

References: https://vercel.com/docs/environment-variables, https://vercel.com/docs/functions/runtimes/node-js/node-js-versions, https://supabase.com/docs/guides/auth/redirect-urls.

## Authentication troubleshooting

The earlier message "Check your email, password and input fields." also masked server configuration failures. The updated handler distinguishes AUTH_CONFIGURATION (HTTP 503), AUTH_INPUT (HTTP 400), provider errors and unexpected server errors. Input messages never echo submitted credentials. Server diagnostics record only an event code and error class.

If authentication fails after deploying, verify SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_BASE_URL in the environment actually used by the deployment. This application expects those exact names, without a NEXT_PUBLIC_ prefix. Use the new sb_publishable_ key. APP_BASE_URL must match the live browser origin. Save changes and redeploy the updated source. The local ignored .env is not a substitute for Vercel environment variables.

Regression checks: npm test covers safe error classification, and npm run test:auth-deployment starts the compiled app with empty provider environment and expects AUTH_CONFIGURATION/503. It does not connect to a live provider.

## Authentication rate limits

Supabase HTTP 429 is a provider limit. The app now distinguishes AUTH_EMAIL_RATE_LIMITED from AUTH_RATE_LIMITED and preserves a valid Retry-After value where supplied. It does not disable email verification or raise/bypass provider limits.

For signup/resend failures, inspect Supabase Auth logs for over_email_send_rate_limit. Supabase documents a small built-in email sending quota (currently 2 emails/hour); configure custom SMTP in the project's Auth email settings for your live site's confirmation emails, then review the project's configured email rate limit. An SMTP provider and verified sending-domain configuration are external account dependencies, not changes to .env in this application. Follow Supabase's SMTP setup documentation. Do not share SMTP credentials in chat.

For over_request_rate_limit, stop repeated attempts and follow Retry-After if supplied. The frontend never retries automatically. Its default 60-second pause when no provider retry time is supplied is a click-prevention interval, not a promise that an hourly quota has reset. Existing confirmation links/codes may still work when only email sending is limited.

References: https://supabase.com/docs/guides/auth/rate-limits and https://supabase.com/docs/guides/auth/auth-smtp.
