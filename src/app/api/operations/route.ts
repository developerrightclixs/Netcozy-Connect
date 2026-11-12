import { NextRequest, NextResponse } from "next/server";
import { session, setSession, ServiceError } from "@/lib/supabase/server";
import { applicationOrigin } from "@/lib/env.mjs";
import { isAdmin } from "@/features/core/domain";
import { failure } from "@/features/real-estate/server-error";
import { studioProviders } from "@/integrations/media-ai/provider";
export async function GET(request: NextRequest) {
  try {
    const s = await session(request);
    const roles = await s.client.table<{ role: string }>(
      "roles",
      "user_id=eq." + s.user.id,
    );
    if (!isAdmin(roles.map((r) => r.role)))
      throw new ServiceError(403, "Administrator access required.");
    const tables = [
      "profiles",
      "properties",
      "market_listings",
      "event_tickets",
      "studio_brands",
      "studio_assets",
    ];
    const checks = await Promise.all(
      tables.map(async (table) => {
        try {
          await s.client.table(table, "select=id&limit=1");
          return { name: table, status: "REACHABLE" };
        } catch {
          return {
            name: table,
            status: "UNAVAILABLE",
            detail: "Review migrations, RLS and provider availability.",
          };
        }
      }),
    );
    const originConfigured = !!process.env.APP_BASE_URL;
    let httpsOrigin = false;
    try {
      httpsOrigin =
        originConfigured &&
        applicationOrigin(request.nextUrl.origin).startsWith("https://");
    } catch {}
    const response = NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        checks,
        deployment: {
          configuredOrigin: originConfigured,
          httpsOrigin,
          serverSessions: "HTTP_ONLY",
          schemaCheck:
            "Read reachability only; does not prove migration definitions, RLS isolation or Storage configuration.",
        },
        providers: studioProviders,
        remaining: [
          "Hosted multi-account acceptance and actual email delivery",
          "Private Storage and signed URL expiry verification",
          "Backups, restoration drill and recovery objectives",
          "External monitoring and alert ownership",
          "Live provider permissions, spend limits and webhook verification",
          "Production security review, distributed rate limiting and full CSP validation",
        ],
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
