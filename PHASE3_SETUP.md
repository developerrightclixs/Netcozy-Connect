# Phase 3 development setup and acceptance

Phase 3 is approved: recruitment, yachts/aviation, vehicles and events/ticketing. Phase 4 is not approved. Code/local checks do not establish hosted readiness. No remote migration, live payment or external message was performed by the agent.

## Apply only the new migrations

The user reported that 003-005 succeeded. In that same authorized **development** Supabase project, inspect migration history first, then run the entire contents of these files in order:

1. [202611110006_marketplace.sql](supabase/migrations/202611110006_marketplace.sql): domain tables, role/visibility helpers, RLS and immutable audit triggers.
2. [202611110007_module_workflows.sql](supabase/migrations/202611110007_module_workflows.sql): validated drafts, independent publication, agent acceptance, talent opt-in/applications and structured inquiries.
3. [202611110008_event_ticketing.sql](supabase/migrations/202611110008_event_ticketing.sql): atomic registrations, cancellation/check-in and clearly fictitious demo catalog.

Each is transactional and checks its prerequisites. A successful SQL Editor run normally says “Success. No rows returned.” Stop on the first error and retain that error. Do not run only fragments, skip prerequisites, drop/reset objects, or rerun 001-005. If any Phase 3 draft was independently applied, reconcile changes through a new additive migration after inspecting existing objects; do not edit applied migrations.

Read-only presence check after all three succeed:

```sql
select
  to_regclass('public.nc_market_listings') as listings,
  to_regclass('public.nc_talent_candidates') as candidates,
  to_regclass('public.nc_event_orders') as orders,
  to_regclass('public.nc_event_tickets') as tickets,
  to_regprocedure('public.nc_register_event(jsonb)') as registration;
```

All should be non-NULL. This checks presence only, not hosted RLS or functionality. Redeploy the source after setup. There are no new environment variables for free/demo Phase 3 workflows. Preserve current Supabase URL/publishable key, APP_BASE_URL and code-only Auth email configuration.

## Roles and accounts

Use accounts you control in separate browser profiles. Bootstrap the intended super-admin using the existing [Supabase setup](SUPABASE_SETUP.md), then assign ordinary module roles through Administration. Never self-grant roles through browser data or use a service-role key for acceptance tests.

| Role | Allowed work |
| --- | --- |
| MEMBER | Own talent profile/opt-in, applications, marketplace inquiries, event registration/tickets |
| RECRUITER | Recruitment opportunity drafts, owned applications and shortlist/decline |
| SELLER | Vehicle dealer listings; yacht/aircraft listings with an opted-in assigned agent |
| AGENT | Broker vehicle listings, assignment opt-in and current-version yacht/aircraft acceptance/inquiries |
| ORGANIZER | Owned event listings, attendee cancellations and one-time ticket check-in |
| ADMIN / SUPER_ADMIN | Independent content review and explicit administrative visibility; never self-review |

At minimum use a listing owner (RECRUITER/SELLER/ORGANIZER), a separate administrator/reviewer, an AGENT and ordinary applicant/buyer accounts. ADMIN capabilities do not make identity, credentials or inventory verified. “PUBLISHED” means the exact supplied content revision was approved for display.

## Hosted acceptance sequence

1. **Auth and earlier phases**: actual signup email code, wrong-code rejection, resend/cooldown, sign-in/out, refresh, earlier property forms/private evidence. Confirm canonical HTTPS origin and mobile layout.
2. **Recruitment**: owner creates a DEMO TESTER opportunity in Talent & testers > Your listings. Ordinary members must be rejected if trying the same privileged mutation. Submit; a separate admin publishes from Reviews. An owner must never approve their own listing.
3. **Opt-in acquisition**: ordinary applicant enables platform matching and creates a matching DEMO profile in Talent profile, explicitly checking publication consent. Verify exact skill/region/remote reasons from the recruiter's Matching tab. The profile includes supplied display fields, not Auth email or contact details. Uncheck publication and save, or withdraw platform matching: other ordinary users must lose profile discovery. No scraper or third-party prospect import exists.
4. **Applications**: apply through the owned published opportunity; an unrelated member must not read its application/message. Recruiter can shortlist/decline; applicant can withdraw. Withdraw consent or edit the opportunity revision and attempt shortlisting again: reject it. Existing private records are retained for history; there is one application per applicant/listing, not an automatic reapplication loop.
5. **Assigned agents**: AGENT opts in under Yachts & vehicles > Agent profile. Owner creates a DEMO yacht/aircraft listing and selects that agent. Submission must fail before current-version acceptance. Agent accepts under Your listings > Your agent assignments; owner submits, independent reviewer publishes. An edit must reset to DRAFT and clear acceptance. Agent deactivation/role withdrawal must hide public inventory and deny new agent actions. No real professional credential claim is made.
6. **Vehicle/inquiry flow**: create dealer inventory with SELLER, broker inventory with AGENT. Check make/model/year/mileage/fuel constraints and category/search filters. Another user explicitly submits a private in-app inquiry with platform matching consent. Only sender, owner, current accepted agent (where applicable) or authorized admin may read it. Accept/decline/withdraw updates the in-app record only; no email/social message or contact detail unlock occurs. Consent withdrawal and stale listing revisions must block acceptance. Global demo inventory has no fake seller inbox.
7. **Events**: ORGANIZER creates a DEMO event with dates, deadline, venue, capacity and price in explicit currency. Review independently. Register using a buyer account and explicitly acknowledge simulation. Expect DEMO/CONFIRMED order with immutable price/event snapshot, private random ticket references and no charge. Real zero-price events issue FREE registrations. Real paid checkout must remain BLOCKED, including direct API calls; no card form, payment-success claim or refund is implemented.
8. **Capacity/replay**: use an event with capacity 1. Submit simultaneous registrations from separate hosted users: at most one succeeds. Replay the same buyer request key: expect the same order and ticket count, never an extra booking. Different request keys for the same active registration must also fail. Cancel unused registration and confirm capacity is available again. Events with active registrations cannot be edited/archived. Local tests verify serial capacity/replay boundaries and locking structure, not actual hosted concurrent load.
9. **Ticket use**: buyer/organizer can inspect their authorized references; unrelated users cannot. Organizer checks a valid ticket once; replay must fail. Cancelled tickets cannot check in; checked-in orders cannot cancel. A real event's check-in opens two hours before start and closes at event end; demo check-in may be exercised earlier. References are opaque codes, not QR scans. Print uses the browser print dialog.
10. **History/RLS**: review Module activity and core admin audit. Review, consent, order price and activity history must reject ordinary UPDATE/DELETE requests, including direct requests. Anonymous users cannot read any Phase 3 table or call mutation RPCs. Verify no session tokens appear in browser URLs, public output or logs.

## Limits and provider dependencies

Browse is authenticated, paginated in 12-record pages with title search/category filters. Working panels display bounded recent records: 100 candidate profiles, owned/assigned listings, applications, inquiries, orders, reviews and activity events; up to 500 accessible tickets. A candidate cannot apply as another user or use a global fictitious candidate profile. Global sample listings/candidates have no fake Auth users, real contact information, actual consent, identity verification or admission. Fixed demo event dates eventually expire normally.

Real paid checkout needs an operator-selected payment service, merchant setup/credentials, verified webhook processing, replay/settlement/refund handling and separate end-to-end acceptance before activation. Current provider is explicitly BLOCKED; do not add keys to the browser or manually mark a real order as paid. External messaging, real identity/credential verification, licensed inventory feeds and Phase 4 marketing/LI3K remain unavailable.

Local checks use actual disposable PGlite PostgreSQL with simulated Supabase Auth/Storage HTTP. They do not prove hosted Auth/email, Storage service behavior, multi-session transaction stress or any real payment/provider integration. Final commands/results are recorded in IMPLEMENTATION_PLAN.md.
