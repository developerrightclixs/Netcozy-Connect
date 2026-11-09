import { z } from "zod";
import { industries, intents, stages, roles } from "./domain";
const text = (max: number) => z.string().trim().max(max);
const uuid = z.string().uuid();
export const profileSchema = z
  .object({
    display_name: text(100).min(2),
    headline: text(240),
    region: text(100),
    skills: z.array(text(50).min(1)).max(30),
    linkedin_url: z.union([
      z.literal(""),
      z
        .string()
        .regex(/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/),
    ]),
    onboarding_complete: z.boolean(),
  })
  .strict();
export const goalSchema = z
  .object({
    industry: z.enum(industries),
    intent: z.enum(intents),
    target_intent: z.enum(intents),
    title: text(160).min(3),
    region: text(100),
    skills: z.array(text(50).min(1)).max(30),
    active: z.boolean().default(true),
  })
  .strict();
export const consentSchema = z
  .object({
    purpose: z.enum(["matching", "contact-sharing", "marketing"]),
    channel: z.enum(["platform", "email", "sms", "whatsapp"]),
    granted: z.boolean(),
  })
  .strict();
export const feedbackSchema = z
  .object({
    goal_id: uuid,
    directory_id: uuid,
    status: z.enum(["SAVED", "DISMISSED"]),
  })
  .strict();
export const draftSchema = z
  .object({ goal_id: uuid, directory_id: uuid, template_id: uuid })
  .strict();
export const editDraftSchema = z
  .object({ id: uuid, body: text(3000).min(10) })
  .strict();
export const leadSchema = z
  .object({
    goal_id: uuid,
    directory_id: uuid,
    draft_id: uuid.nullable(),
    pipeline: z.enum(["PERSONAL", "B2B", "RECRUITMENT"]),
  })
  .strict();
export const stageSchema = z
  .object({
    id: uuid,
    stage: z.enum(stages),
    notes: text(3000),
    manual_attestation: z.boolean(),
  })
  .strict();
export const templateSchema = z
  .object({
    template_key: text(100)
      .min(1)
      .regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    title: text(100).min(1),
    body: text(3000).min(10),
    approved: z.boolean(),
  })
  .strict();
export const weightsSchema = z
  .object({
    industry: z.number().min(0).max(100),
    intent: z.number().min(0).max(100),
    region: z.number().min(0).max(100),
    skills: z.number().min(0).max(100),
    available: z.number().min(0).max(100),
  })
  .strict()
  .refine((v) => Object.values(v).reduce((a, b) => a + b, 0) > 0);
export const roleSchema = z
  .object({ user_id: uuid, role: z.enum(roles), remove: z.boolean() })
  .strict();
export const idSchema = z.object({ id: uuid }).strict();
export const authSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
export const searchSchema = z
  .object({
    label: text(100).min(1),
    filters: z
      .object({
        industry: z.string().max(40),
        region: text(100),
        saved: z.boolean(),
      })
      .strict(),
  })
  .strict();
