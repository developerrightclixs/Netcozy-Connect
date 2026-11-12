import { z } from "zod";
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const brandSchema = z
  .object({
    name: text(2, 100),
    website: z.union([z.literal(""), z.url().startsWith("https://").max(300)]),
    industry: text(2, 100),
    audience: text(5, 1000),
    offer: text(5, 1000),
    voice: text(2, 200),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    acknowledge: z.literal(true),
  })
  .strict();
const creativeFields = {
  title: text(3, 150),
  kind: z.enum(["TEXT", "IMAGE", "VIDEO"]),
  channel: z.enum(["LINKEDIN", "INSTAGRAM", "FACEBOOK", "MANUAL"]),
  scheduled_at: z.iso.datetime({ offset: true }).nullable(),
};
export const demoSchema = z.object(creativeFields).strict();
export const creativeSchema = z
  .object({
    ...creativeFields,
    id: z.uuid().optional(),
    revision: z.number().int().positive().optional(),
    caption: text(5, 5000),
    script: z.string().max(10000),
    audience: text(5, 1000),
  })
  .strict()
  .refine((v) => !v.id || !!v.revision, "Revision required for editing");
export const versionSchema = z
  .object({ id: z.uuid(), revision: z.number().int().positive() })
  .strict();
export const reviewSchema = versionSchema.extend({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: text(5, 1000),
  acknowledge: z.literal(true),
});
const count = z.number().int().min(0).max(1000000000);
export const metricsSchema = versionSchema
  .extend({
    request_key: z.uuid(),
    period_start: z.iso.date(),
    period_end: z.iso.date(),
    views: count,
    clicks: count,
    replies: count,
    conversions: count,
    evidence: text(5, 500),
    acknowledge: z.literal(true),
  })
  .refine(
    (v) => v.period_end >= v.period_start,
    "Reporting period end must follow start",
  );
export type Brand = z.infer<typeof brandSchema> & {
  id: string;
  owner_id: string;
  revision: number;
};
export type Creative = z.infer<typeof creativeSchema> & {
  id: string;
  owner_id: string;
  revision: number;
  brand_revision: number;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPORTED";
  source: "MANUAL" | "DEMO_TEMPLATE";
  updated_at: string;
  asset_id: string | null;
};
export type StudioAsset = {
  id: string;
  label: string;
  object_key: string;
  status: string;
  mime_type: string;
  byte_size: number;
  rights_note: string;
};
export type StudioData = {
  brand: Brand | null;
  creatives: Creative[];
  pending: Creative[];
  assets: StudioAsset[];
  reviews: {
    id: string;
    creative_id: string;
    revision: number;
    decision: string;
    note: string;
  }[];
  exports: {
    id: string;
    creative_id: string;
    revision: number;
    created_at: string;
  }[];
  usage: { id: string; operation: string; provider_calls: number }[];
  metrics: {
    id: string;
    creative_id: string;
    period_start: string;
    period_end: string;
    views: number;
    clicks: number;
    replies: number;
    conversions: number;
    evidence: string;
    source: string;
  }[];
};
