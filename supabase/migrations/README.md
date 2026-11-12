# Supabase migrations

Apply the versioned SQL files in order using the authorized development project's SQL Editor or existing Supabase CLI migration workflow. Read SUPABASE_SETUP.md first, including its existing-state check and Auth user backfill impact. The agent has not applied these files to a hosted project.

- 202611100001_shared_core.sql: personal account core, Auth profile trigger/backfill, RLS, consent/audit history, matching rules, templates, drafts, pipeline and admin helpers.
- 202611100002_demo_directory.sql: twelve fictitious demo directory records; no fake Auth users.
- 003–005: properties, partner workflows and private property evidence; see SUPABASE_SETUP.md.
- 006–008: marketplace/recruitment workflows and event tickets; see PHASE3_SETUP.md.
- 202611120009_studio.sql: private brand/creative/review/export/usage/manual-report workflows.
- 202611120010_studio_assets.sql: private PNG/JPEG library, immutable object registration and review-invalidating attachment. See PHASE4_SETUP.md for prerequisites and hosted acceptance.

No production reset or destructive migration is provided. Never edit an already applied migration; introduce a new version. Future exposed tables must have appropriate grants and tested row-level security. No identity photographs or documents are collected by this phase.
