import { identityProvider } from "@/integrations/identity/provider";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  session,
  setSession,
  sameOrigin,
  ServiceError,
  type Session,
} from "@/lib/supabase/server";
import {
  rankMatches,
  latestConsent,
  renderTemplate,
  isAdmin,
  defaultWeights,
  type Goal,
  type Person,
  type Row,
  type Weights,
} from "@/features/core/domain";
import * as v from "@/features/core/validation";
const eq = (id: string) => "id=eq." + encodeURIComponent(id);
async function owned(s: Session, table: string, id: string) {
  const rows = await s.client.table<Row>(
    table,
    eq(id) + "&owner_id=eq." + s.user.id,
  );
  if (!rows[0]) throw new ServiceError(404, "Record not found.");
  return rows[0];
}
async function roles(s: Session) {
  return (
    await s.client.table<{ role: string }>("roles", "user_id=eq." + s.user.id)
  ).map((r) => r.role);
}
function allowed(value: boolean, message = "Permission denied.") {
  if (!value) throw new ServiceError(403, message);
}
async function matchingConsent(s: Session) {
  const consents = await s.client.table<{
    id: string;
    purpose: string;
    channel: string;
    granted: boolean;
    created_at: string;
  }>("consents", "owner_id=eq." + s.user.id + "&order=created_at.desc,id.desc");
  return latestConsent(consents, "matching", "platform");
}
async function bootstrap(s: Session) {
  const assigned = await roles(s);
  const owner = "owner_id=eq." + s.user.id;
  const [
    profiles,
    goals,
    consents,
    identity,
    directory,
    templates,
    feedback,
    drafts,
    leads,
    searches,
    rules,
    audit,
    privacy,
  ] = await Promise.all([
    s.client.table<Row>("profiles", eq(s.user.id)),
    s.client.table<Goal>("goals", owner + "&order=created_at.desc"),
    s.client.table<{
      id: string;
      purpose: string;
      channel: string;
      granted: boolean;
      created_at: string;
    }>("consents", owner + "&order=created_at.desc,id.desc"),
    s.client.table<Row>("identity_checks", owner + "&order=created_at.desc"),
    s.client.table<Person>("directory"),
    s.client.table<Row>("templates", "approved=eq.true&order=version.desc"),
    s.client.table<Row>("match_feedback", owner),
    s.client.table<Row>("drafts", owner + "&order=updated_at.desc"),
    s.client.table<Row>("leads", owner + "&order=updated_at.desc"),
    s.client.table<Row>("saved_searches", owner),
    s.client.table<{ weights: Weights }>("matching_rules", "id=eq.1"),
    s.client.table<Row>(
      "audit",
      "actor_id=eq." + s.user.id + "&order=created_at.desc&limit=100",
    ),
    s.client.table<Row>("privacy_requests", owner + "&order=created_at.desc"),
  ]);
  const weights = v.weightsSchema.safeParse(rules[0]?.weights);
  const consent = latestConsent(consents, "matching", "platform");
  const matches = consent
    ? goals.flatMap((goal) =>
        rankMatches(
          goal,
          directory,
          weights.success ? weights.data : defaultWeights,
        )
          .filter(
            (p) =>
              !feedback.some(
                (f) =>
                  f.goal_id === goal.id &&
                  f.directory_id === p.id &&
                  f.status === "DISMISSED",
              ) &&
              !leads.some(
                (l) =>
                  l.goal_id === goal.id &&
                  l.directory_id === p.id &&
                  ["CLOSED_WON", "CLOSED_LOST"].includes(String(l.stage)),
              ),
          )
          .map((p) => ({ ...p, goal_id: goal.id, goal_title: goal.title })),
      )
    : [];
  let admin: Record<string, unknown> | null = null;
  if (isAdmin(assigned)) {
    const [users, allRoles, checks, requests, events, versions] =
      await Promise.all([
        s.client.table<Row>("profiles", "order=created_at.desc&limit=200"),
        s.client.table<Row>("roles"),
        s.client.table<Row>(
          "identity_checks",
          "order=created_at.desc&limit=200",
        ),
        s.client.table<Row>(
          "privacy_requests",
          "order=created_at.desc&limit=200",
        ),
        s.client.table<Row>("audit", "order=created_at.desc&limit=200"),
        s.client.table<Row>("templates", "order=created_at.desc"),
      ]);
    admin = {
      users,
      roles: allRoles,
      checks,
      requests,
      audit: events,
      templates: versions,
      weights: weights.success ? weights.data : defaultWeights,
    };
  }
  return {
    user: { id: s.user.id, email: s.user.email },
    roles: assigned,
    profile: profiles[0] ?? null,
    goals,
    consents,
    identity,
    directory,
    templates,
    feedback,
    drafts,
    leads,
    searches,
    matches,
    privacy,
    audit,
    admin,
    weights: weights.success ? weights.data : defaultWeights,
    providers: {
      identity: "DEMO",
      linkedin: "BLOCKED",
      socialSending: "NOT IMPLEMENTED",
      sms: "BLOCKED",
      whatsapp: "BLOCKED",
    },
  };
}
async function mutation(s: Session, action: string, data: unknown) {
  const c = s.client;
  const owner_id = s.user.id;
  switch (action) {
    case "onboarding": {
      const input = v.profileSchema
        .omit({ onboarding_complete: true })
        .merge(v.goalSchema.omit({ region: true, skills: true, active: true }))
        .extend({
          goal_id: z.string().uuid(),
          matching_consent: z.literal(true),
        })
        .strict()
        .parse(data);
      return c.rpc("complete_onboarding", { input });
    }
    case "profile":
      return c.table(
        "profiles",
        eq(owner_id),
        "PATCH",
        v.profileSchema.parse(data),
      );
    case "goal":
      return c.table("goals", "", "POST", {
        ...v.goalSchema.parse(data),
        owner_id,
      });
    case "goal-edit": {
      const input = v.goalSchema.extend({ id: z.string().uuid() }).parse(data);
      await owned(s, "goals", input.id);
      const { id, ...changes } = input;
      return c.table("goals", eq(id), "PATCH", changes);
    }
    case "goal-toggle": {
      const input = z
        .object({ id: z.string().uuid(), active: z.boolean() })
        .strict()
        .parse(data);
      await owned(s, "goals", input.id);
      return c.table("goals", eq(input.id), "PATCH", { active: input.active });
    }
    case "consent":
      return c.table("consents", "", "POST", {
        ...v.consentSchema.parse(data),
        owner_id,
      });
    case "identity":
      return identityProvider.start(c);
    case "feedback": {
      const input = v.feedbackSchema.parse(data);
      await owned(s, "goals", input.goal_id);
      const query =
        "owner_id=eq." +
        owner_id +
        "&goal_id=eq." +
        input.goal_id +
        "&directory_id=eq." +
        input.directory_id;
      const existing = await c.table("match_feedback", query);
      return existing.length
        ? c.table("match_feedback", query, "PATCH", { status: input.status })
        : c.table("match_feedback", "", "POST", { ...input, owner_id });
    }
    case "search":
      return c.table("saved_searches", "", "POST", {
        ...v.searchSchema.parse(data),
        owner_id,
      });
    case "draft": {
      allowed(
        await matchingConsent(s),
        "Enable matching consent before preparing outreach.",
      );
      const input = v.draftSchema.parse(data);
      const goal = await owned(s, "goals", input.goal_id);
      const [people, templates] = await Promise.all([
        c.table<Person>("directory", eq(input.directory_id)),
        c.table<Row>("templates", eq(input.template_id) + "&approved=eq.true"),
      ]);
      const p = people[0],
        t = templates[0];
      allowed(
        !!p && !!t,
        "An opted-in demo match and approved template are required.",
      );
      allowed(
        p.industry === goal.industry && p.intent === goal.target_intent,
        "This person is not eligible for the selected goal.",
      );
      return c.table("drafts", "", "POST", {
        ...input,
        owner_id,
        body: renderTemplate(String(t.body), {
          name: p.name,
          industry: p.industry,
          goal: String(goal.title),
        }),
      });
    }
    case "draft-edit": {
      const input = v.editDraftSchema.parse(data);
      await owned(s, "drafts", input.id);
      return c.table("drafts", eq(input.id), "PATCH", {
        body: input.body,
        reviewed_at: null,
      });
    }
    case "draft-review": {
      const { id } = v.idSchema.parse(data);
      await owned(s, "drafts", id);
      allowed(await matchingConsent(s), "Matching consent has been revoked.");
      return c.table("drafts", eq(id), "PATCH", {
        reviewed_at: new Date().toISOString(),
      });
    }
    case "lead": {
      const input = v.leadSchema.parse(data);
      await owned(s, "goals", input.goal_id);
      if (input.draft_id) await owned(s, "drafts", input.draft_id);
      return c.table("leads", "", "POST", {
        ...input,
        owner_id,
        stage: input.draft_id ? "DRAFTED" : "SUGGESTED",
      });
    }
    case "stage": {
      const input = v.stageSchema.parse(data);
      const lead = await owned(s, "leads", input.id);
      if (
        ["SENT", "ACCEPTED", "REPLIED", "QUALIFIED", "CLOSED_WON"].includes(
          input.stage,
        )
      ) {
        allowed(
          input.manual_attestation,
          "Confirm this is a manually recorded demo outcome.",
        );
        allowed(await matchingConsent(s), "Matching consent has been revoked.");
        allowed(
          typeof lead.draft_id === "string",
          "A reviewed draft is required.",
        );
        const draft = await owned(s, "drafts", String(lead.draft_id));
        allowed(!!draft.reviewed_at, "Review the current draft first.");
      }
      return c.table("leads", eq(input.id), "PATCH", {
        stage: input.stage,
        notes: input.notes,
      });
    }
    case "privacy": {
      const input = z
        .object({ kind: z.enum(["EXPORT", "DELETE"]) })
        .strict()
        .parse(data);
      return c.table("privacy_requests", "", "POST", { ...input, owner_id });
    }
    case "template": {
      allowed(isAdmin(await roles(s)));
      return c.table("templates", "", "POST", {
        ...v.templateSchema.parse(data),
        created_by: owner_id,
      });
    }
    case "weights": {
      allowed(isAdmin(await roles(s)));
      return c.table("matching_rules", "id=eq.1", "PATCH", {
        weights: v.weightsSchema.parse(data),
      });
    }
    case "role": {
      allowed(
        (await roles(s)).includes("SUPER_ADMIN"),
        "Super admin required.",
      );
      const input = v.roleSchema.parse(data);
      return c.rpc("assign_role", {
        subject: input.user_id,
        wanted_role: input.role,
        remove_role: input.remove,
      });
    }
    case "privacy-status": {
      allowed(isAdmin(await roles(s)));
      const input = z
        .object({
          id: z.string().uuid(),
          status: z.enum(["PENDING", "IN_REVIEW", "FULFILLED"]),
        })
        .strict()
        .parse(data);
      return c.table("privacy_requests", eq(input.id), "PATCH", {
        status: input.status,
      });
    }
    default:
      throw new ServiceError(
        400,
        "Unsupported action. Automatic sending is not available.",
      );
  }
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof ServiceError
          ? error.message
          : error instanceof z.ZodError
            ? "Check the highlighted field requirements."
            : "The request could not be completed. Please try again.",
    },
    {
      status:
        error instanceof ServiceError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function GET(request: NextRequest) {
  try {
    const s = await session(request);
    const response = NextResponse.json(await bootstrap(s), {
      headers: { "Cache-Control": "private, no-store" },
    });
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const s = await session(request);
    const result = await mutation(s, String(body.action), body.data);
    const response = NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
