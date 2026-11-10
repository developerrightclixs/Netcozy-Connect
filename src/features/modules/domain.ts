import { z } from "zod";
export const modules = [
  "TALENT",
  "YACHT",
  "AVIATION",
  "VEHICLE",
  "EVENT",
] as const;
export type Module = (typeof modules)[number];
export const moduleLabels: Record<Module, string> = {
  TALENT: "Talent & testers",
  YACHT: "Yachts",
  AVIATION: "Aviation",
  VEHICLE: "Vehicles",
  EVENT: "Events",
};
const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
const skills = z.array(text(50, 1)).min(1).max(20);
const year = z.number().int().min(1900).max(2100);
export const factsSchemas = {
  TALENT: z
    .object({
      kind: z.enum(["JOB", "TESTER", "COMMISSION"]),
      skills,
      remote: z.boolean(),
      engagement: text(240, 3),
    })
    .strict(),
  YACHT: z
    .object({
      length_m: z.number().min(1).max(300),
      year,
      guests: z.number().int().min(1).max(1000),
      offer: z.enum(["SALE", "CHARTER"]),
    })
    .strict(),
  AVIATION: z
    .object({
      make: text(80, 1),
      model: text(100, 1),
      year,
      seats: z.number().int().min(1).max(1000),
      hours: z.number().min(0).max(1000000),
      offer: z.enum(["SALE", "CHARTER"]),
    })
    .strict(),
  VEHICLE: z
    .object({
      make: text(80, 1),
      model: text(100, 1),
      year,
      mileage_km: z.number().min(0).max(10000000),
      fuel: text(40, 2),
      seller_type: z.enum(["DEALER", "BROKER"]),
    })
    .strict(),
  EVENT: z
    .object({
      starts_at: z.string().datetime(),
      ends_at: z.string().datetime(),
      closes_at: z.string().datetime(),
      venue: text(240, 3),
      capacity: z.number().int().min(1).max(10000),
    })
    .strict()
    .refine(
      (f) =>
        Date.parse(f.ends_at) > Date.parse(f.starts_at) &&
        Date.parse(f.closes_at) <= Date.parse(f.starts_at),
      "Check event start, end and registration close times.",
    ),
};
export const listingSchema = z
  .object({
    id: z.string().uuid().optional(),
    module: z.enum(modules),
    title: text(140, 3),
    region: text(100, 2),
    summary: text(2000, 10),
    facts: z.unknown(),
    price_minor: z.number().int().min(0).max(100000000000).nullable(),
    currency: z.enum(["USD", "PKR", "EUR", "GBP"]),
    is_demo: z.boolean(),
    agent_id: z.string().uuid().nullable(),
  })
  .strict()
  .transform((l, ctx) => {
    const result = factsSchemas[l.module].safeParse(l.facts);
    if (!result.success) {
      for (const issue of result.error.issues)
        ctx.addIssue({ ...issue, path: ["facts", ...issue.path] });
      return z.NEVER;
    }
    if (["EVENT", "TALENT"].includes(l.module) && l.price_minor === null) {
      ctx.addIssue({
        code: "custom",
        message: "A price or compensation amount is required (zero for free).",
        path: ["price_minor"],
      });
      return z.NEVER;
    }
    return { ...l, facts: result.data };
  });
export const candidateSchema = z
  .object({
    name: text(100, 2),
    headline: text(180, 3),
    region: text(100, 2),
    skills,
    kind: z.enum(["JOB", "TESTER", "COMMISSION"]),
    remote: z.boolean(),
    available: z.boolean(),
    bio: text(1500),
    discoverable: z.boolean(),
    is_demo: z.boolean(),
    attested: z.boolean(),
  })
  .strict()
  .refine(
    (c) => !c.discoverable || c.attested,
    "Consent to publish this profile is required.",
  );
export const agentSchema = z
  .object({
    display_name: text(100, 2),
    business_name: text(140),
    active: z.boolean(),
  })
  .strict();
export const listingActionSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["submit", "archive", "accept-agent", "review"]),
    decision: z.enum(["PUBLISHED", "REJECTED"]).optional(),
    note: text(2000, 5).optional(),
    acknowledge: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => v.action !== "review" || (v.decision && v.note && v.acknowledge),
    "Review decision, explanation and acknowledgement required.",
  );
export const applySchema = z
  .object({ listing_id: z.string().uuid(), message: text(2000, 10) })
  .strict();
export const applicationActionSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["SHORTLISTED", "DECLINED", "WITHDRAWN"]),
  })
  .strict();
export const inquirySchema = applySchema
  .extend({ attested: z.literal(true) })
  .strict();
export const inquiryActionSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["ACCEPTED", "DECLINED", "WITHDRAWN"]),
  })
  .strict();
export const registerSchema = z
  .object({
    listing_id: z.string().uuid(),
    request_key: z.string().uuid(),
    quantity: z.number().int().min(1).max(5),
    attested: z.literal(true),
    demo_attestation: z.boolean(),
  })
  .strict();
export const idSchema = z.object({ id: z.string().uuid() }).strict();
export const checkinSchema = z
  .object({
    listing_id: z.string().uuid(),
    reference: text(32).regex(/^[a-f0-9]{32}$/),
  })
  .strict();
export type Listing = {
  id: string;
  owner_id: string | null;
  module: Module;
  title: string;
  region: string;
  summary: string;
  facts: Record<string, string | number | boolean | string[]>;
  price_minor: number | null;
  currency: string;
  is_demo: boolean;
  revision: number;
  status: string;
  agent_id: string | null;
  agent_accepted_revision: number | null;
  updated_at: string;
};
export type Candidate = z.infer<typeof candidateSchema> & {
  id: string;
  owner_id: string | null;
  revision: number;
};
export type Agent = z.infer<typeof agentSchema> & {
  owner_id: string;
  updated_at: string;
};
export type Application = {
  id: string;
  listing_id: string;
  candidate_id: string;
  applicant_id: string;
  recruiter_id: string;
  message: string;
  status: string;
  listing_revision: number;
  profile_snapshot: {
    name: string;
    headline: string;
    region: string;
    skills: string[];
    bio: string;
    is_demo: boolean;
  };
  listing_snapshot: { title: string; revision: number };
  created_at: string;
};
export type Inquiry = {
  id: string;
  listing_id: string;
  sender_id: string;
  owner_id: string;
  agent_id: string | null;
  message: string;
  status: string;
  listing_revision: number;
  created_at: string;
};
export type Order = {
  id: string;
  listing_id: string;
  buyer_id: string;
  organizer_id: string | null;
  request_key: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  currency: string;
  mode: "DEMO" | "FREE";
  status: string;
  event_snapshot: {
    title: string;
    region: string;
    facts: Record<string, string | number>;
    is_demo: boolean;
  };
  created_at: string;
};
export type Ticket = {
  id: string;
  order_id: string;
  listing_id: string;
  buyer_id: string;
  reference: string;
  status: string;
  checked_in_at: string | null;
};
export type Review = {
  id: string;
  listing_id: string;
  revision: number;
  decision: string;
  note: string;
  reviewer_id: string;
};
export type History = {
  id: number;
  listing_id: string;
  action: string;
  entity_id: string;
  created_at: string;
  details: Record<string, unknown>;
};
export type ModuleData = {
  userId: string;
  roles: string[];
  matchingConsent: boolean;
  listings: Listing[];
  owned: Listing[];
  assignments: Listing[];
  candidates: Candidate[];
  candidate: Candidate | null;
  agents: Agent[];
  applications: Application[];
  inquiries: Inquiry[];
  orders: Order[];
  tickets: Ticket[];
  reviews: Review[];
  history: History[];
  pending: Listing[];
  page: number;
  hasNext: boolean;
};
export function rankCandidates(
  job: Listing,
  candidates: Candidate[],
  consent: boolean,
) {
  if (!consent || job.module !== "TALENT") return [];
  const needs = (Array.isArray(job.facts.skills) ? job.facts.skills : []).map(
    (s) => s.trim().toLowerCase(),
  );
  return candidates
    .filter(
      (c) =>
        c.available &&
        c.discoverable &&
        c.is_demo === job.is_demo &&
        c.kind === job.facts.kind &&
        ((Boolean(job.facts.remote) && c.remote) ||
          c.region.trim().toLowerCase() === job.region.trim().toLowerCase()),
    )
    .map((c) => {
      const found = [...new Set(needs)].filter((s) =>
        c.skills.some((x) => x.toLowerCase().trim() === s),
      );
      const score =
        40 + Math.round((60 * found.length) / Math.max(1, new Set(needs).size));
      return {
        ...c,
        score,
        reasons: [
          c.region.trim().toLowerCase() === job.region.trim().toLowerCase()
            ? "Region matches"
            : "Remote work preference matches",
          c.kind + " opportunity",
          found.length
            ? "Matching skills: " + found.join(", ")
            : "No exact skill matches; review carefully",
        ],
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function formatPrice(amount: number | null, currency: string) {
  return amount === null
    ? "Price on request"
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(Number(amount) / 100);
}
