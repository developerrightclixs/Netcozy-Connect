import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  session,
  sameOrigin,
  setSession,
  type Session,
} from "@/lib/supabase/server";
import { isAdmin, latestConsent } from "@/features/core/domain";
import { failure } from "@/features/real-estate/server-error";
import * as v from "@/features/modules/domain";
import {
  eventRegistration,
  livePayments,
} from "@/integrations/payments/provider";
async function bootstrap(s: Session, request: NextRequest) {
  const c = s.client,
    id = s.user.id;
  const kind = z
    .enum([...v.modules, "ALL", "MARKET"])
    .parse(request.nextUrl.searchParams.get("module") ?? "ALL");
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(request.nextUrl.searchParams.get("page") ?? 0);
  const search = z
    .string()
    .trim()
    .max(100)
    .parse(request.nextUrl.searchParams.get("q") ?? "");
  const filter =
    (kind === "ALL"
      ? ""
      : kind === "MARKET"
        ? "&module=in.(YACHT,AVIATION,VEHICLE)"
        : "&module=eq." + kind) +
    (search
      ? "&title=ilike." +
        encodeURIComponent("%" + search.replace(/[\\%_*]/g, "\\$&") + "%")
      : "");
  const roles = (
    await c.table<{ role: string }>("roles", "user_id=eq." + id)
  ).map((r) => r.role);
  const consents = await c.table<{
    id: string;
    purpose: string;
    channel: string;
    granted: boolean;
    created_at: string;
  }>("consents", "owner_id=eq." + id + "&order=created_at.desc,id.desc");
  const matchingConsent = latestConsent(consents, "matching", "platform");
  const [
    listings,
    owned,
    assignments,
    candidates,
    ownCandidates,
    agents,
    applications,
    inquiries,
    orders,
    tickets,
    reviews,
    history,
    pending,
  ] = await Promise.all([
    c.table<v.Listing>(
      "market_listings",
      "status=eq.PUBLISHED" +
        filter +
        "&order=updated_at.desc,id.asc&limit=13&offset=" +
        page * 12,
    ),
    c.table<v.Listing>(
      "market_listings",
      "owner_id=eq." + id + "&order=updated_at.desc&limit=100",
    ),
    c.table<v.Listing>(
      "market_listings",
      "agent_id=eq." + id + "&order=updated_at.desc&limit=100",
    ),
    matchingConsent
      ? c.table<v.Candidate>(
          "talent_candidates",
          "discoverable=eq.true&available=eq.true&order=updated_at.desc&limit=100",
        )
      : Promise.resolve([]),
    c.table<v.Candidate>("talent_candidates", "owner_id=eq." + id),
    c.table<v.Agent>("market_agents", "order=display_name.asc&limit=100"),
    c.table<v.Application>(
      "talent_applications",
      "order=updated_at.desc&limit=100",
    ),
    c.table<v.Inquiry>("market_inquiries", "order=updated_at.desc&limit=100"),
    c.table<v.Order>("event_orders", "order=created_at.desc&limit=100"),
    c.table<v.Ticket>("event_tickets", "order=created_at.desc&limit=500"),
    c.table<v.Review>("market_reviews", "order=created_at.desc&limit=100"),
    c.table<v.History>("module_history", "order=id.desc&limit=100"),
    isAdmin(roles)
      ? c.table<v.Listing>(
          "market_listings",
          "status=eq.PENDING_REVIEW&order=updated_at.asc&limit=100",
        )
      : Promise.resolve([]),
  ]);
  return {
    userId: id,
    roles,
    matchingConsent,
    listings: listings.slice(0, 12),
    owned,
    assignments,
    candidates,
    candidate: ownCandidates[0] ?? null,
    agents,
    applications,
    inquiries,
    orders,
    tickets,
    reviews,
    history,
    pending,
    page,
    hasNext: listings.length > 12,
    providers: {
      payments: livePayments,
      externalMessaging: "BLOCKED",
      identity: "DEMO / NOT REAL VERIFICATION",
    },
  };
}
async function mutate(s: Session, action: string, data: unknown) {
  const c = s.client;
  switch (action) {
    case "listing-save":
      return c.rpc("save_market_listing", {
        input: v.listingSchema.parse(data),
      });
    case "listing-action":
      return c.rpc("market_listing_action", {
        input: v.listingActionSchema.parse(data),
      });
    case "agent-save":
      return c.rpc("save_market_agent", { input: v.agentSchema.parse(data) });
    case "candidate-save":
      return c.rpc("save_talent_candidate", {
        input: v.candidateSchema.parse(data),
      });
    case "apply":
      return c.rpc("apply_talent", { input: v.applySchema.parse(data) });
    case "application-action":
      return c.rpc("talent_application_action", {
        input: v.applicationActionSchema.parse(data),
      });
    case "inquiry":
      return c.rpc("market_inquiry", { input: v.inquirySchema.parse(data) });
    case "inquiry-action":
      return c.rpc("market_inquiry_action", {
        input: v.inquiryActionSchema.parse(data),
      });
    case "register":
      return eventRegistration.register(c, v.registerSchema.parse(data));
    case "cancel-order":
      return c.rpc("cancel_event_order", { input: v.idSchema.parse(data) });
    case "checkin":
      return c.rpc("checkin_event_ticket", {
        input: v.checkinSchema.parse(data),
      });
    default:
      throw new z.ZodError([
        {
          code: "custom",
          path: ["action"],
          message:
            "Unsupported action. External sending and live payment are unavailable.",
        },
      ]);
  }
}
export async function GET(request: NextRequest) {
  try {
    const s = await session(request);
    const response = NextResponse.json(await bootstrap(s, request), {
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
    const s = await session(request);
    const body = z
      .object({ action: z.string().max(50), data: z.unknown() })
      .strict()
      .parse(await request.json());
    const result = await mutate(s, body.action, body.data);
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
