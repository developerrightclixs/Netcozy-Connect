# Netcozy Connect — Codex Development Instructions

> **Source of product requirements:** *Netcozy Connect — Final Presentation*, prepared by Premium Web Agency for Netcozy Holdings Inc., October 2026 (32 pages).  
> **Purpose:** Give Codex a clear, implementable engineering brief.  
> **Status:** Proposed product, not a claim that features, legal permissions, API access, or partner integrations already exist.

## 0. Instructions for Codex — read first

You are the lead full-stack engineer implementing **Netcozy Connect**, a relevance-first networking, matchmaking, lead-pipeline, marketplace and marketing platform. Work directly in the current repository.

1. First inspect the existing repository (`package.json`, folder structure, config, schema, environment examples). **Do not overwrite working code or redesign an existing application without need.**
2. Write a short `IMPLEMENTATION_PLAN.md` summarizing what exists, what is missing, dependencies, implementation order and decisions.
3. Implement the platform incrementally as production-quality, cohesive vertical slices. Start with **authentication → onboarding → profiles/goals → matches → outreach assistant → pipeline → admin**, then add domain modules and integrations.
4. Keep the project runnable after each slice. Add migrations, seed data, tests and useful empty/loading/error states as you go.
5. Never claim an unavailable API is connected. Build typed provider interfaces and local demo adapters where credentials or permissions are missing. Clearly label demo/simulated data.
6. Do not build platform-rule-evading bots, false social identities, unauthorized scrapers, cold social DMs, auto-dialers, unauthorized SMS/WhatsApp sends, or investment solicitation features.
7. **Human review/send controls must be enforced in backend services**, not only hidden or disabled in the UI.
8. Before any destructive change, migration involving existing data, or production integration, inspect the impact and avoid data loss. Do not print credentials or sensitive identifiers.
9. Update `README.md`, `.env.example`, tests and implementation progress when a feature is completed. Provide actual build/test results rather than claiming success without running them.
10. Do not silently assume that every proposed capability is achievable in the presentation's stated eight-week schedule; implement priorities below and track later-phase work explicitly.

### Suggested starting command for Codex

```text
Read NETCOZY_CODEX_INSTRUCTIONS.md completely. Inspect this repository first, then create IMPLEMENTATION_PLAN.md and begin Phase 1. Implement real working features, migrations, tests, responsive UI and seeded demo data. Use demo adapters for unavailable third-party services, and document every dependency. Do not ask me for routine design choices; use the documented defaults, while surfacing blocked external integrations and legal requirements.
```

---

## 1. Product goals and operating rules

Netcozy serves multiple industries and audiences using **one shared account, consent, matching and pipeline system**.

Original business opportunities in the presentation:

- Recruit paid app/product testers and commission-based sign-up partners for Workaway Weekend, LI3K and MONI.
- Reach businesses with Netcozy services as employee benefits or client-reward programs.
- Find vacant lots, stale property listings, owners, agents, brokers, lenders and developers for legitimate networking and potential joint ventures.
- Let administrators edit outreach messages and templates without involving developers.
- Add yacht/aviation, vehicle broker, event and LI3K AI marketing workflows.

**Product principles from the source:**

1. Quality and relevance over bulk outreach.
2. The system prepares assisted social messages; a real person decides and sends them.
3. Collect contact details and external profile links with appropriate permission and notices; do not scrape them.
4. One real account per person, subject to identity verification.
5. Verify property and financial claims or conspicuously mark them unverified.

**Compliance guardrails:** Collect opt-ins, retain consent evidence, honor unsubscribe/deletion requests, use licensed external datasets, keep sensitive documents protected, and maintain an audit trail. Jurisdiction-specific rules require legal verification; this file is not legal advice. Do not enable securities marketing, commission-plan representations or regulated auto brokering without client counsel/appropriate licenses.

---

## 2. Recommended technical architecture (implementation recommendations, not specified vendor commitments)

The presentation allows React or similar frontend, Node.js or Python API, PostgreSQL, and dedicated/private cloud. For a practical unified build, use:

- **Frontend/backend:** Next.js App Router, React, TypeScript, Tailwind CSS, accessible component library (e.g. shadcn/ui), React Hook Form, Zod.
- **Database:** PostgreSQL with Prisma ORM, versioned migrations and seed scripts.
- **Authentication:** A production-ready session/auth provider or established auth library; password/email sign-in and email verification. Optional 2FA if supported. Never implement homegrown password cryptography.
- **Authorization:** Server-enforced role-based access control and organization boundaries where relevant.
- **Jobs:** Durable job queue/worker for imported listings, background matching, email tasks and provider webhooks. Use idempotency and retry/backoff.
- **Uploads:** Private object storage with signed URLs, access checks, size/type controls and malware scanning when supported.
- **Integrations:** Interface-first adapters for ID verification, LinkedIn login, licensed property feeds, dealer/business data, consent-based email/SMS/WhatsApp, post/letter provider, Stripe, and AI media services.
- **Observability:** Structured logs, error reporting, health checks, background job status and audit events.
- **Deployment:** Private/dedicated hosting architecture or isolated cloud environment, HTTPS, automated backups and documented restoration. Final provider is a client decision.

### Proposed code organization

```text
src/
  app/
    (marketing)/
    (auth)/
    (dashboard)/
      dashboard/
      onboarding/
      matches/
      outreach/
      pipeline/
      talent/
      real-estate/
      yachts-aviation/
      vehicles/
      events/
      li3k-studio/
      settings/
      admin/
    api/
  components/
  features/
    auth/ onboarding/ profiles/ matching/ consent/ campaigns/
    outreach/ pipeline/ talent/ real-estate/ yachts-aviation/
    vehicles/ events/ li3k/ admin/
  lib/
    db/ auth/ validation/ permissions/ storage/ audit/
  integrations/
    identity/ linkedin/ property-data/ auto-data/ business-data/
    email/ sms/ whatsapp/ direct-mail/ payments/ media-ai/
  jobs/
prisma/
  schema.prisma
  seed.ts
scripts/
tests/
```

Adapt this to the actual repository structure; do not duplicate architectures.

---

## 3. Shared foundation — implemented once, used by all six modules

### Identity and onboarding

**Nine-step source flow:**

1. Visitor selects sign up.
2. Email/password and confirmation.
3. ID check through an external provider.
4. Store only verification result/reference, **never ID photographs**.
5. Select industry then intent (buy, sell, hire, attend, partner, etc.).
6. Optional LinkedIn sign-in and profile/resume import where officially permitted, plus user-supplied social handles.
7. User reviews and corrects their profile.
8. User answers relevant goal questions.
9. Dashboard displays the first ranked match list.

Support multiple goal profiles on a single verified account (e.g. vehicle seller and event attendee). Provide self-service consent preferences, contact-sharing controls, data export/deletion requests and activity history.

### Roles and access

Implement role-specific permission sets, at minimum:

- `MEMBER`: manage own profile, goals, matches, outreach drafts and pipeline.
- `RECRUITER`: access authorized candidate workflows, recruiter templates and candidate pipeline.
- `SELLER`: manage own listings, evidence and verification status.
- `AGENT`: manage assigned yacht/aviation and/or vehicle leads, approved listings and transactions.
- `PARTNER_COMPANY`: access own approved forms, referrals and assigned leads.
- `ORGANIZER`: create and manage events, ticket inventory and guest lists.
- `ADMIN`: review users, listings, campaign templates, approvals, reports, exports and audit log.
- `SUPER_ADMIN`: tenant/platform settings, integrations, permission management and compliance configuration.

A person may hold more than one scoped role where needed. Build least-privilege backend guards.

### Intent-based matching

Industry + intent + goal determine eligible matches. Start with **explainable rules-based scoring**, not an opaque AI ranking model. Inputs may include location, role, skill fit, industry, availability, budget, property attributes and verified status. Return:

- Match score and human-readable reasons.
- Why each factor matched, and exclusion reasons when feasible.
- Ranked list updated weekly as goals and pipeline outcomes change.
- Filters, saved searches, bookmarking and dismissing results.

Create a deterministic matching service with configurable weights and tests. Demo scores are illustrative only.

### Outreach assistant and consent

- Admin-controlled template library, purposes/channels, merge fields, version history and previews.
- Personalized draft generation; human selects/edits before social outreach.
- `Open on LinkedIn` may copy a message and open a permitted profile/link for a **manual send**. No automated connection request sending.
- User can mark stages: `SUGGESTED`, `DRAFTED`, `SENT`, `ACCEPTED`, `REPLIED`, `QUALIFIED`, `CLOSED_WON`, `CLOSED_LOST` (stages may be mapped to source terminology).
- Request phone/email details after contact accepts and gives appropriate consent.
- Record consent timestamp, purpose, method, policy version, channel and revocation.
- Separate pipelines for recruitment, B2B businesses and industry-specific deals, while sharing infrastructure.

### Admin dashboard

Implement overview KPIs; user verification queue; role assignment; profile/listing review; goal and match analytics; template approvals; lead stages; import runs; integration health; delivery/opt-out logs; consent requests; audit log; configurable matching rules; and CSV exports under access controls.

---

## 4. Module A — Talent, recruiters, testers and referral programs

Build:

- Tester/member sign-up landing pages and qualifying forms (device, region, availability, skills, testing preferences).
- Recruiter requisitions (target quantity, location, candidate criteria, offered compensation).
- Ranked lists of **opted-in** candidates and authorized imported contacts.
- Recruiter-managed outreach through their own permitted LinkedIn Recruiter seat, with local drafts and manual sending.
- Separate candidate and B2B sales pipelines.
- Referral attribution and commission-work onboarding; expose only claims approved by client/legal review.
- Tester assignments and statuses; TestFlight and Google Play testing invitation workflows via approved mechanisms.
- Meta click/comment/lead-form opt-ins followed by official Meta/ManyChat-supported automation, if the client's apps and permissions support it.
- Waitlist management, including the presentation's cited TestFlight external tester cap of 10,000 per app (verify current platform rules before relying on this operationally).

**Acceptance scenario:** A recruiter requests 20 paid testers in Texas; the system ranks consenting candidates, explains the fit, prepares a personalized draft, allows manual sending and tracks filled positions.

---

## 5. Module B — Real estate and land development

Build:

- Real estate search/import from CSV and **properly licensed** feeds (MLS/IDX/RESO Web API, ATTOM, Regrid, SimplyRETS, etc., if contracted and authorized).
- Property fields: address/area, lot size, zoning, utilities, road access, asking price, listing status, ownership documents and other supplied evidence.
- Per-claim verification checklist (`VERIFIED`, `UNVERIFIED`, `REJECTED`, `NEEDS_REVIEW`). Do not present missing evidence as confirmed.
- Owner and developer/partner records with region and deal preferences.
- Scoring and matching of land opportunities to suitable developers and joint-venture partners.
- Outreach log, approved email sequences where lawful, direct mail provider, manually initiated calls and consent-gated texts.
- Partner-specific form templates, field mapping, automated prefill, **mandatory human reviewer approval**, send from authorized domain and immutable send log.
- Save import source/license details, job status, deduplication and data update timestamps.

**Prohibited:** Scraping Zillow or Realtor.com; falsely claiming property verification; autonomously submitting unchecked development forms. The client supplies licensed feed access and bears provider fees.

**Acceptance scenario:** Import 40 example vacant lots through seeded CSV, check evidence, match relevant developers, generate a partner form, require approval, and record a sent event.

---

## 6. Module C — Yachts and aviation

- Distinct yacht and aircraft buyer/seller onboarding.
- Seller ID verification and listings with specifications, registry documents, surveys and photos.
- Buyer verification and optional proof-of-funds upload with restricted document access.
- Dedicated verified agent profile, listing approval queue and agent inbox.
- Buyers contact **agents**, not sellers directly; hide seller contact details from public listings.
- Deal status and referral handoff to Engel & Völkers for contract/escrow via a documented manual handoff initially.
- Integration adapter for Engel & Völkers **only if their approved API/feed and agreement are provided**.
- Advisor-assisted cross-category matchmaking if authorized client records and privacy terms permit it.

Do not trace owners behind corporate shells, infer wealth, or scrape aviation/maritime registries.

---

## 7. Module D — Vehicles and dealer brokerage

- Dealer, broker, owner, buyer and agent profiles.
- Dealer-approved listings created via forms, CSV, permitted feeds or licensed automotive datasets.
- Vehicle information: make/model/year/market/condition/inventory quantity/price and availability.
- Brokerage fee configuration as flat amount or percentage; display fee breakdown clearly.
- Buyer saved searches/alerts for market and vehicle type, offers and dealer-confirmation workflow.
- Deal stages from inquiry through escrow/shipping partner handoff and delivery.
- B2B outreach to licensed business contacts by lawful email; WhatsApp stock alerts **only to users who opted in**.
- Geographic scoping for Los Angeles, wider US and permitted international markets.

Before enabling actual California brokering, confirm applicable dealer/broker licensing. Do not disguise unapproved inventory or sellers.

---

## 8. Module E — Events, art, concerts, parties and festivals

- Verified organizers create events with title, category, venue, location, date/time, media, artist/lineup or catalog, capacity, ticket type and price.
- Admin approval and event publishing.
- Attendee interests, browse/search, free RSVP and paid ticket checkout.
- Stripe-hosted or properly implemented checkout, signed webhooks and verified payment outcomes.
- QR-coded tickets with secure redemption/check-in and duplicate-scan prevention.
- Organizer attendee list with appropriately scoped privacy and export permissions.
- Segmented opt-in event announcements; email/SMS/WhatsApp only when permitted.
- Promotion funnels: landing pages → interest capture → advertiser-owned official pixels/lead forms → audience segments → consent-based broadcasts.
- Track registrations, conversions and event lead sources, with ad costs billed to Netcozy.

Events mentioned in the presentation include VIP parties, art openings, music concerts and festivals.

---

## 9. Module F — LI3K AI marketing studio

Workflow: **Business profile → audience analysis → creative generation → approved publishing/distribution → analytics and learning**.

- Business onboarding via supplied website and approved Google business data, or manual form.
- AI-assisted target audience and messaging recommendations, subject to review.
- Image and video creative workflows through API providers, with persistent media asset library.
- Editable captions, scripts, message templates and brand settings.
- Campaign calendar, draft/approval/publish statuses and channel-specific consent rules.
- Integrate a real publishing API **only when permissions and service capabilities are confirmed**. Otherwise provide export/manual publication assistance.
- Capture opens, clicks, pageviews, replies and conversions where legitimately available; never promise per-person social post analytics that APIs do not provide.
- Pricing configuration: approximate paid plan **$1,000 for ~100 posts**, and a free plan tied to qualifying Netcozy service sign-ups (commercial terms require approval).
- Usage/billing dashboard with image/video API call counts and cost estimates.

Presentation's illustrative internal content volume: 8 videos + 16 images per week (roughly 32 videos + 64 images monthly), with illustrative tool cost around $90/month plus AI text and usage-dependent costs. **Do not hardcode these prices as live provider rates**.

Example integration candidates: Creatomate, image API, Cloudinary, Mux, Google Places API and text generation API. OpenArt is described as manual-only in the proposal; do not assume a public programmatic API exists.

---

## 10. Channel automation and safety rules

| Channel | Supported capability | Required constraints |
|---|---|---|
| LinkedIn/social matching | Draft and open original platform, manual send | One real account, no bot invitations, no prohibited scraping |
| Meta lead flow | Automate post-opt-in routing and tester sign-up | User initiates via comment/click/form; approved Meta API/permissions |
| B2B/owner email | Sequences, follow-ups, unsubscribe and opt-out logging | Validate local laws, data origin, provider policy, consent/legal basis where applicable |
| Direct mail | Print/post through contracted provider | Verify content, address source and jurisdictional rules |
| SMS | First contact manually where allowed; gated follow-ups | Prior consent when required; evidence and opt-out checks |
| Calls | Click-to-dial and logged notes | DNC review and applicable calling requirements; no unauthorized autodial/AI voice |
| WhatsApp | Opt-in broadcasts and alerts through official Business API | Valid consent/opt-out and approved templates as required |
| Property/auto data | Scheduled sync | Authenticated licensed feed, no unauthorized scraping |
| Property forms | Generate/prefill and distribute | Mandatory reviewer approval before submission |
| Investment/JV offers | Networking and referral tracking only initially | Counsel-approved compliance before any securities offering feature |

Legal details vary by jurisdiction and may evolve. Implement configurable controls, not a simplistic global legality switch.

---

## 11. Suggested data model

Use Prisma with explicit relations, indexes and migrations. Suggested entities:

- **Identity/core:** `User`, `Account`, `Session`, `Organization`, `OrganizationMember`, `RoleAssignment`, `IdentityVerification`, `UserProfile`, `IndustryProfile`, `UserGoal`, `SocialHandle`, `Document`.
- **Privacy/security:** `ConsentRecord`, `PrivacyRequest`, `AuditEvent`, `IntegrationCredentialReference`, `NotificationPreference`.
- **Matching/outreach:** `Match`, `MatchReason`, `MatchFeedback`, `Template`, `TemplateVersion`, `OutreachDraft`, `OutreachEvent`, `Pipeline`, `PipelineStage`, `Lead`, `LeadActivity`, `Campaign`, `CampaignRecipient`, `ChannelDelivery`, `UnsubscribeEvent`.
- **Talent:** `RecruitmentRequest`, `CandidateApplication`, `TesterAssignment`, `Referral`, `ReferralAttribution`.
- **Real estate:** `Property`, `PropertyClaim`, `PropertyDocument`, `PropertyOwnerContact`, `DataImport`, `ImportRecord`, `DevelopmentPartner`, `PartnerFormTemplate`, `PartnerFormSubmission`, `ApprovalRequest`.
- **Yacht/aviation:** `LuxuryAsset`, `AgentAssignment`, `LuxuryInquiry`, `HandoffRecord`.
- **Vehicles:** `Dealer`, `Vehicle`, `VehicleOffer`, `BrokerFee`, `VehicleDeal`.
- **Events:** `Event`, `TicketType`, `EventOrder`, `Ticket`, `TicketCheckIn`, `EventInterest`.
- **LI3K:** `BusinessProfile`, `BrandKit`, `MarketingAudience`, `CreativeAsset`, `MarketingPost`, `PublishingJob`, `AnalyticsSnapshot`, `UsageRecord`, `SubscriptionPlan`, `Subscription`.
- **System:** `ImportJob`, `BackgroundJob`, `WebhookEvent`, `ProviderSyncStatus`.

Add created/updated timestamps, ownership and unique constraints as appropriate. Keep raw payment/ID details outside application storage and use provider references. Enforce tenant boundaries in queries and mutations.

---

## 12. UI/UX requirements

Build a premium, modern SaaS dashboard, not a generic admin template. Design direction (implementation recommendation): clean light interface, deep navy and teal accents inspired by the proposal, generous whitespace, readable typography, responsive tables/cards, strong filtering and informative status labels. Use clear, accessible forms and keyboard navigation.

Minimum screens:

1. Public homepage and module-specific landing pages.
2. Sign-up/sign-in, email verification and identity-check states.
3. Guided industry → intent → goal onboarding.
4. Shared user dashboard with relevant matches, explanations and tasks.
5. Match details, saved matches and outreach draft editor.
6. Personal/B2B/recruitment pipeline kanban and table views.
7. Role-specific module pages for all six modules.
8. Listing creation/editing, evidence upload and review.
9. Admin dashboard, user/approval queues, template manager, audit history and integrations health.
10. Privacy/consent preferences, account export/deletion request, profile settings and notifications.

Use honest demo records: clearly tag example listings, contacts, metrics and scores as fictitious.

---

## 13. Delivery phases and definition of done

**Important:** The source proposal states an eight-week full delivery for **$2,499 paid at signing**, with provider costs separate. The final slide inconsistently refers to launch in **8–12 weeks**. The detailed weekly plan explicitly allocates weeks 2–5 to the shared core, weeks 6–7 to real estate, and week 8 to testing/launch; it does **not** break out implementation time for the other four domain modules and LI3K. These are proposal claims, not engineering estimates or acceptance criteria. Ask project stakeholders to approve priorities and milestones before treating them as binding.

### Phase 0 — Repo audit and plan

- Inspect code and dependencies.
- Produce `IMPLEMENTATION_PLAN.md` and a feature checklist.
- Configure local/dev setup, database and environment examples.
- Establish coding, test and security conventions.

### Phase 1 — Shared core (first working end-to-end MVP)

- Auth, roles, onboarding, goal profiles and verification abstraction.
- Consent records and access guards.
- Explainable matching with seeded records.
- Draft outreach and manual send assist.
- Pipeline and admin foundation.
- Tests for access boundaries, match scoring and consent gates.

### Phase 2 — Real estate and forms

- Property management/import and verification.
- Developer matching, owner outreach logging.
- Partner forms, approval/sign-off and audit history.

### Phase 3 — Talent/testers + other marketplace modules

- Tester/recruiter flows and opt-in acquisition adapter.
- Yachts/aviation agent marketplace.
- Vehicle dealer/broker marketplace.
- Event organizer/checkout/ticketing workflows.

### Phase 4 — LI3K, advanced integrations and production hardening

- AI media workflow and utilization reporting.
- Authorized marketing platform connectors.
- Real provider connectivity, where keys and contracts are supplied.
- E2E tests, security review, migration validation, monitoring and deployment runbook.

### Definition of done per feature

A feature is complete only when:

- It works from UI to database in local development.
- Server-side authorization, validation and consent checks are in place.
- Errors, loading states and empty states are handled.
- Sensitive data isn't exposed in logs, responses or public assets.
- Relevant unit/integration tests pass.
- An admin can review the feature if approvals are relevant.
- README/ENV and the checklist describe how to run it.
- Any dependency on a third-party integration is explicitly flagged as `DEMO`, `BLOCKED`, `CONFIGURED` or `VERIFIED`, never silently simulated as live.

---

## 14. Environment and provider checklist

Create `.env.example` with placeholders and explanations, **no real secrets**. Depending on the actual architecture, these may include:

```dotenv
DATABASE_URL=
APP_BASE_URL=
AUTH_SECRET=
EMAIL_FROM=
EMAIL_PROVIDER_API_KEY=
IDENTITY_PROVIDER_API_KEY=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
PROPERTY_DATA_PROVIDER=
PROPERTY_DATA_API_KEY=
BUSINESS_DATA_API_KEY=
AUTO_DATA_API_KEY=
META_APP_ID=
META_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
SMS_PROVIDER_API_KEY=
DIRECT_MAIL_PROVIDER_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MEDIA_IMAGE_API_KEY=
CREATOMATE_API_KEY=
CLOUDINARY_URL=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
GOOGLE_PLACES_API_KEY=
```

Only include env vars actually used by implemented adapters. The above is a discovery checklist, not a claim of provider availability.

Client dependencies named in the presentation: target regions and launch date, service offers, legal review for commissions and stock/JV offers, partner forms, preferred licensed property data provider, hosting/verification/email accounts, designated day-to-day approver, and relevant partner integration permissions.

---

## 15. Testing and acceptance scenarios

Implement representative automated tests for:

- A user can sign up, verify email, progress through goal onboarding and view seeded matches.
- Identity verification result/reference is stored without retaining uploaded ID photos in application storage.
- User A cannot read or change User B's private details or documents.
- A user with multiple industry profiles receives relevant industry-specific results.
- A recruiter can progress a consenting candidate through the pipeline and count filled positions.
- A real estate CSV import deduplicates records; unverified claims remain marked unverified.
- A generated developer partner form cannot be sent without reviewer approval.
- Outreach drafts never trigger LinkedIn/social auto-sends.
- SMS/WhatsApp broadcast cannot be queued to a recipient without required consent.
- Opt-outs prevent subsequent campaigns; consent/revocation is auditable.
- Agent-gated yacht/aircraft inquiries do not disclose seller information.
- Dealer/broker fee appears on a vehicle offer and links to deal status.
- Successful Stripe webhook produces tickets exactly once and QR redemption prevents double check-in.
- Marketing studio generates a demo asset and tracks usage without misrepresenting demo publication as live.
- Admin action audit events preserve actor/action/entity and timestamps.

Run and report whichever scripts are actually available: `lint`, `typecheck`, `test`, `build`, database migrations and relevant smoke tests. Fix failures before describing a phase as complete.

---

## 16. Progress reporting format for Codex

After every working slice, respond with:

```text
Implemented:
- [specific user-visible features]

Files changed:
- [paths]

Database:
- [migrations + how to apply]

Verification:
- [commands and results]

Demo / blocked providers:
- [named adapters and reason]

Next slice:
- [specific scope]
```

**Start now:** audit the repository, write `IMPLEMENTATION_PLAN.md`, and implement Phase 1 in small, verifiable slices. Keep the site clean, mobile-responsive, accessible and free of fake success states or unauthorized automation.
