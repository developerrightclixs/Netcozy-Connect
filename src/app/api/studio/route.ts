import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  session,
  sameOrigin,
  setSession,
  ServiceError,
} from "@/lib/supabase/server";
import { failure } from "@/features/real-estate/server-error";
import { isAdmin } from "@/features/core/domain";
import * as v from "@/features/studio/domain";
import { studioProviders } from "@/integrations/media-ai/provider";
export async function GET(request: NextRequest) {
  try {
    const s = await session(request),
      c = s.client;
    const roles = await c.table<{ role: string }>(
      "roles",
      "user_id=eq." + s.user.id,
    );
    const own = "owner_id=eq." + s.user.id;
    const [
      brands,
      creatives,
      pending,
      reviews,
      exports,
      usage,
      metrics,
      assets,
    ] = await Promise.all([
      c.table("studio_brands", own),
      c.table(
        "studio_creatives",
        own + "&order=updated_at.desc,id.asc&limit=100",
      ),
      isAdmin(roles.map((r) => r.role))
        ? c.table(
            "studio_creatives",
            "status=eq.PENDING_REVIEW&order=updated_at.asc&limit=100",
          )
        : [],
      c.table("studio_reviews", own + "&order=created_at.desc&limit=100"),
      c.table(
        "studio_exports",
        own +
          "&select=id,creative_id,revision,created_at&order=created_at.desc&limit=100",
      ),
      c.table("studio_usage", own + "&order=created_at.desc&limit=100"),
      c.table("studio_metrics", own + "&order=created_at.desc&limit=100"),
      c.table("studio_assets", "order=created_at.desc&limit=100"),
    ]);
    const response = NextResponse.json(
      {
        brand: brands[0] ?? null,
        creatives,
        pending,
        reviews,
        exports,
        usage,
        metrics,
        assets,
        providers: studioProviders,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
    // Bound streamed bodies too; Content-Length alone is not trustworthy.
    const reader = request.body?.getReader();
    if (!reader) throw new ServiceError(400, "Request body required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new ServiceError(413, "Studio request exceeds 32 KB.");
      }
      chunks.push(part.value);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ServiceError(400, "Send a valid JSON studio request.");
    }
    const body = z
      .object({ action: z.string(), data: z.unknown() })
      .strict()
      .parse(parsed);
    if (body.action === "asset-attach") {
      const input = v.versionSchema
        .extend({ creative_id: z.uuid() })
        .parse(body.data);
      const result = await s.client.rpc("studio_asset", {
        input: { ...input, action: "attach" },
      });
      const response = NextResponse.json(
        { ok: true, result },
        { headers: { "Cache-Control": "private, no-store" } },
      );
      if (s.tokens) setSession(response, s.tokens);
      return response;
    }
    let data;
    switch (body.action) {
      case "brand-save":
        data = v.brandSchema.parse(body.data);
        break;
      case "creative-save":
        data = v.creativeSchema.parse(body.data);
        break;
      case "demo-prepare":
        data = v.demoSchema.parse(body.data);
        break;
      case "submit":
      case "export":
        data = v.versionSchema.parse(body.data);
        break;
      case "review":
        data = v.reviewSchema.parse(body.data);
        break;
      case "metrics":
        data = v.metricsSchema.parse(body.data);
        break;
      default:
        throw new ServiceError(
          409,
          "Live generation and publishing are unavailable. Use preparation and reviewed manual export.",
        );
    }
    const result = await s.client.rpc("studio_mutate", {
      input: { action: body.action, data },
    });
    const response = NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
