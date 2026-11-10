import { z } from "zod";
export const listingStates = [
  "AVAILABLE",
  "UNDER_REVIEW",
  "CLOSED",
  "WITHDRAWN",
] as const;
export const claimStates = [
  "UNVERIFIED",
  "NEEDS_REVIEW",
  "VERIFIED",
  "REJECTED",
] as const;
export const claimKeys = [
  "address",
  "lot_acres",
  "zoning",
  "utilities",
  "road_access",
  "asking_price",
  "listing_status",
  "ownership",
] as const;
const text = (max: number) => z.string().trim().max(max);
export const propertyFacts = z
  .object({
    address: text(240).min(3),
    region: text(100).min(2),
    postal_code: text(20).default(""),
    lot_acres: z
      .number()
      .finite()
      .positive()
      .max(1000000)
      .refine(
        (v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 0.00001,
        "Use at most three decimal places.",
      ),
    zoning: text(100).default(""),
    utilities: text(240).default(""),
    road_access: text(240).default(""),
    asking_price: z
      .number()
      .finite()
      .nonnegative()
      .max(999999999999.99)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.01,
        "Use at most two decimal places.",
      ),
    listing_status: z.enum(listingStates).default("AVAILABLE"),
  })
  .strict();
export const propertySchema = propertyFacts
  .extend({
    source: text(200).min(3),
    license_evidence: text(2000).min(5),
    is_demo: z.boolean(),
    attested: z.literal(true),
  })
  .strict();
export const editPropertySchema = propertySchema
  .omit({ is_demo: true })
  .extend({ id: z.string().uuid() })
  .strict();
export const importMetaSchema = z
  .object({
    request_key: z.string().uuid(),
    source: text(200).min(3),
    license_evidence: text(2000).min(5),
    is_demo: z.boolean(),
    attested: z.literal(true),
  })
  .strict();
export const developerSchema = z
  .object({
    name: text(120).min(2),
    region: text(100).min(2),
    min_acres: z.number().finite().min(0).max(1000000),
    max_acres: z.number().finite().positive().max(1000000),
    max_price: z.number().finite().positive().max(999999999999.99),
    zoning: z.array(text(100).min(1)).max(20),
    preferences: text(1000),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    email_opt_in: z.boolean(),
    permission_evidence: text(2000),
    is_demo: z.boolean(),
    active: z.boolean(),
  })
  .strict()
  .refine(
    (v) => v.max_acres >= v.min_acres,
    "Maximum acreage must be at least the minimum.",
  )
  .refine(
    (v) =>
      !v.email_opt_in ||
      (v.permission_evidence.length >= 5 && v.email.length > 0),
    "Email permission needs an email address and evidence.",
  );
export const contactSchema = z
  .object({
    property_id: z.string().uuid(),
    name: text(120).min(2),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    phone: text(40),
    source: text(1000).min(5),
  })
  .strict();
export const permissionSchema = z
  .object({
    contact_id: z.string().uuid(),
    channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "CALL", "POST"]),
    granted: z.boolean(),
    evidence: text(2000).min(5),
  })
  .strict();
export const outreachSchema = z
  .object({
    contact_id: z.string().uuid(),
    channel: z.enum(["NOTE", "EMAIL", "SMS", "WHATSAPP", "CALL", "POST"]),
    notes: text(3000).min(5),
    manual_attestation: z.boolean(),
  })
  .strict();
export const templateSources = [
  "address",
  "region",
  "postal_code",
  "lot_acres",
  "zoning",
  "utilities",
  "road_access",
  "asking_price",
  "listing_status",
  "source",
  "license_evidence",
  "verification_summary",
] as const;
export const partnerTemplateSchema = z
  .object({
    partner_id: z.string().uuid(),
    template_key: text(100).regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    title: text(120).min(3),
    field_mapping: z
      .record(
        z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,49}$/),
        z.enum(templateSources),
      )
      .refine((v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 20),
    approved: z.boolean(),
  })
  .strict();
export const claimRequestSchema = z
  .object({
    property_id: z.string().uuid(),
    claim_key: z.enum(claimKeys),
    evidence_id: z.string().uuid(),
  })
  .strict();
export const claimReviewSchema = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(["VERIFIED", "REJECTED", "UNVERIFIED"]),
    note: text(2000).min(5),
  })
  .strict();
export const formCreateSchema = z
  .object({
    property_id: z.string().uuid(),
    partner_id: z.string().uuid(),
    template_id: z.string().uuid(),
  })
  .strict();
export const formEditSchema = z
  .object({
    id: z.string().uuid(),
    regenerate: z.boolean(),
    fields: z.record(z.string(), text(2000)).default({}),
  })
  .strict();
export const formReviewSchema = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: text(2000).min(5),
    acknowledge_unverified: z.literal(true),
  })
  .strict();
export const idSchema = z.object({ id: z.string().uuid() }).strict();
export const demoEvidenceSchema = z
  .object({
    property_id: z.string().uuid(),
    label: text(120).min(3),
    content_note: text(2000).min(10),
  })
  .strict();
export type Property = z.infer<typeof propertyFacts> & {
  id: string;
  owner_id: string;
  source: string;
  license_evidence: string;
  is_demo: boolean;
  revision: number;
  source_updated_at: string;
  updated_at: string;
};
export type Developer = z.infer<typeof developerSchema> & {
  id: string;
  owner_id: string;
  revision: number;
};
export type Claim = {
  id: string;
  property_id: string;
  claim_key: string;
  claimed_value: string;
  status: string;
  evidence_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
};
export type Evidence = {
  id: string;
  owner_id: string;
  property_id: string;
  label: string;
  content_note: string;
  object_key: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sha256: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
};
export type Contact = z.infer<typeof contactSchema> & {
  id: string;
  owner_id: string;
  is_demo: boolean;
  revision: number;
};
export type Permission = z.infer<typeof permissionSchema> & {
  id: number;
  owner_id: string;
  contact_revision: number;
  created_at: string;
};
export type Outreach = z.infer<typeof outreachSchema> & {
  id: string;
  owner_id: string;
  property_id: string;
  is_demo: boolean;
  mode: string;
  created_at: string;
};
export type PartnerTemplate = {
  id: string;
  owner_id: string | null;
  partner_id: string | null;
  template_key: string;
  version: number;
  title: string;
  field_mapping: Record<string, string>;
  approved: boolean;
  is_demo: boolean;
};
export type PartnerForm = {
  id: string;
  owner_id: string;
  property_id: string;
  partner_id: string;
  template_id: string;
  payload: Record<string, string | boolean>;
  version: number;
  property_revision: number;
  partner_revision: number;
  status: string;
  invalid_reason: string;
  submitted_at: string | null;
};
export type FormReview = {
  id: string;
  form_id: string;
  owner_id: string;
  reviewer_id: string;
  version: number;
  decision: string;
  note: string;
  payload_snapshot: Record<string, unknown>;
  created_at: string;
};
export type Delivery = {
  id: string;
  form_id: string;
  owner_id: string;
  reviewer_id: string;
  form_version: number;
  payload_snapshot: Record<string, unknown>;
  recipient_snapshot: Record<string, unknown>;
  provider_reference: string;
  mode: "DEMO";
  status: "SIMULATED_SENT";
  created_at: string;
};
export type ImportRun = {
  id: string;
  source: string;
  license_evidence: string;
  is_demo: boolean;
  status: string;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
};
export type ImportRow = {
  id: string;
  import_id: string;
  row_number: number;
  property_id: string;
  disposition: string;
};
export type RealEstateData = {
  properties: Property[];
  page: number;
  hasNext: boolean;
  claims: Claim[];
  evidence: Evidence[];
  contacts: Contact[];
  permissions: Permission[];
  outreach: Outreach[];
  developers: Developer[];
  templates: PartnerTemplate[];
  forms: PartnerForm[];
  reviews: FormReview[];
  deliveries: Delivery[];
  imports: ImportRun[];
  importRows: ImportRow[];
  matchingConsent: boolean;
  roles: string[];
  userId: string;
  admin: null | {
    properties: Property[];
    claims: Claim[];
    evidence: Evidence[];
    forms: PartnerForm[];
    developers: Developer[];
    templates: PartnerTemplate[];
    deliveries: Delivery[];
  };
};
export function rankDevelopers(
  property: Property,
  developers: Developer[],
  claims: Claim[],
  consent: boolean,
) {
  if (!consent || property.listing_status !== "AVAILABLE") return [];
  const checked = claims.filter((c) => c.property_id === property.id);
  const verification =
    checked.length === 8 && checked.every((c) => c.status === "VERIFIED");
  return developers
    .filter(
      (d) =>
        d.active &&
        d.is_demo === property.is_demo &&
        d.region.trim().toLowerCase() ===
          property.region.trim().toLowerCase() &&
        Number(property.lot_acres) >= Number(d.min_acres) &&
        Number(property.lot_acres) <= Number(d.max_acres) &&
        Number(property.asking_price) <= Number(d.max_price),
    )
    .map((d) => {
      const zoning = d.zoning.some(
        (z) => z.toLowerCase() === property.zoning.toLowerCase(),
      );
      const reasons = [
        "Region: " + d.region,
        "Lot size within " + d.min_acres + "–" + d.max_acres + " acres",
        "Within supplied budget",
      ];
      if (zoning) reasons.push("Zoning preference: " + property.zoning);
      if (verification)
        reasons.push(
          property.is_demo
            ? "All claims reviewed in demo"
            : "All claims reviewed",
        );
      return {
        ...d,
        score: 75 + (zoning ? 15 : 0) + (verification ? 10 : 0),
        reasons,
        unverified: !verification,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
