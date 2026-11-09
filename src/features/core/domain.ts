export const industries = [
  "talent",
  "business",
  "real-estate",
  "yachts-aviation",
  "vehicles",
  "events",
  "marketing",
] as const;
export const intents = [
  "hire",
  "work",
  "buy",
  "sell",
  "partner",
  "attend",
  "organize",
  "promote",
] as const;
export const roles = [
  "MEMBER",
  "RECRUITER",
  "SELLER",
  "AGENT",
  "PARTNER_COMPANY",
  "ORGANIZER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;
export const stages = [
  "SUGGESTED",
  "DRAFTED",
  "SENT",
  "ACCEPTED",
  "REPLIED",
  "QUALIFIED",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;
export type Row = { id: string; [key: string]: unknown };
export type Goal = {
  id: string;
  industry: string;
  intent: string;
  target_intent: string;
  title: string;
  region: string;
  skills: string[];
  active: boolean;
};
export type Person = {
  id: string;
  name: string;
  headline: string;
  industry: string;
  intent: string;
  region: string;
  skills: string[];
  available: boolean;
  opted_in: boolean;
  is_demo: boolean;
};
export type Weights = {
  industry: number;
  intent: number;
  region: number;
  skills: number;
  available: number;
};
export const defaultWeights: Weights = {
  industry: 35,
  intent: 30,
  region: 15,
  skills: 15,
  available: 5,
};
const normalized = (s: string) => s.trim().toLowerCase();
export function rankMatches(
  goal: Goal,
  people: Person[],
  weights: Weights = defaultWeights,
) {
  if (!goal.active) return [];
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (
    total <= 0 ||
    Object.values(weights).some((n) => !Number.isFinite(n) || n < 0)
  )
    throw new Error("Invalid matching weights");
  return people
    .filter(
      (p) =>
        p.opted_in &&
        p.industry === goal.industry &&
        p.intent === goal.target_intent,
    )
    .map((p) => {
      let earned = weights.industry + weights.intent;
      const reasons = [
        "Industry: " + p.industry,
        "Complementary intent: " + p.intent,
      ];
      if (goal.region && normalized(goal.region) === normalized(p.region)) {
        earned += weights.region;
        reasons.push("Same region: " + p.region);
      }
      const wanted = [...new Set(goal.skills.map(normalized).filter(Boolean))];
      const common = wanted.filter((s) => p.skills.map(normalized).includes(s));
      if (wanted.length && common.length) {
        earned += (weights.skills * common.length) / wanted.length;
        reasons.push("Skills: " + common.join(", "));
      }
      if (p.available) {
        earned += weights.available;
        reasons.push("Available for introductions");
      }
      return { ...p, score: Math.round((100 * earned) / total), reasons };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function latestConsent(
  events: {
    purpose: string;
    channel: string;
    granted: boolean;
    created_at: string;
    id: string;
  }[],
  purpose: string,
  channel: string,
) {
  return (
    [...events]
      .filter((e) => e.purpose === purpose && e.channel === channel)
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      )[0]?.granted === true
  );
}
export function canDeliver(
  channel: string,
  consent: boolean,
  reviewed: boolean,
  optedIn: boolean,
) {
  // Phase 1 supports preparation only. No social/SMS/WhatsApp/email transport is enabled.
  return channel === "manual-social" && consent && reviewed && optedIn;
}
export function renderTemplate(
  body: string,
  fields: { name: string; industry: string; goal: string },
) {
  return body.replace(
    /{{(name|industry|goal)}}/g,
    (_, key: keyof typeof fields) => fields[key],
  );
}
export function isAdmin(assigned: string[]) {
  return assigned.includes("ADMIN") || assigned.includes("SUPER_ADMIN");
}
