# Vercel deployment - Phase 1

The Next.js app can use Vercel's framework defaults; no custom vercel.json or static export is required. This is deployment of the approved Phase 1 preview, not approval for Phase 2. No deployment has been performed by the agent.

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

A Preview deployment is a different origin. Configure APP_BASE_URL for that Preview origin separately, or leave it unset for that environment to use the request origin. The current email template uses Supabase Site URL, so confirmation links go to that configured canonical origin, not automatically to arbitrary Vercel Preview domains. Use a separate Supabase development project with its own Site URL for isolated preview Auth testing.

## Supabase configuration

Follow SUPABASE_SETUP.md to apply/review the two migrations if not already applied. Vercel deployment does not apply them automatically. Never rerun or reset an existing schema blindly.

Under Supabase Authentication URL Configuration, set Site URL to the exact live HTTPS origin. Keep email confirmation enabled. Configure Confirm signup with:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

If configuring a redirect allowlist for provider-managed redirects, use the exact live callback https://YOUR-DOMAIN/auth/confirm and only the development origins you actually need. This template explicitly uses SiteURL; changing the allowlist alone will not change its destination.

## After deployment

Open the canonical HTTPS domain and verify signup, the actual confirmation email/link, login, onboarding and match discovery. Test consent withdrawal and two-account data isolation. Follow SUPABASE_SETUP.md to bootstrap the intended admin account if needed. Check Vercel build/function logs when a step fails, without copying tokens or confirmation links into chat.

The app still displays Phase 1/demo notices and disables indexing through its development metadata. Hosted acceptance, real identity verification and external sending are not claimed complete by publishing a URL.

References: https://vercel.com/docs/environment-variables, https://vercel.com/docs/functions/runtimes/node-js/node-js-versions, https://supabase.com/docs/guides/auth/redirect-urls.

## Authentication troubleshooting

The earlier message "Check your email, password and input fields." also masked server configuration failures. The updated handler distinguishes AUTH_CONFIGURATION (HTTP 503), AUTH_INPUT (HTTP 400), provider errors and unexpected server errors. Input messages never echo submitted credentials. Server diagnostics record only an event code and error class.

If authentication fails after deploying, verify SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_BASE_URL in the environment actually used by the deployment. This application expects those exact names, without a NEXT_PUBLIC_ prefix. Use the new sb_publishable_ key. APP_BASE_URL must match the live browser origin. Save changes and redeploy the updated source. The local ignored .env is not a substitute for Vercel environment variables.

Regression checks: npm test covers safe error classification, and npm run test:auth-deployment starts the compiled app with empty provider environment and expects AUTH_CONFIGURATION/503. It does not connect to a live provider.
