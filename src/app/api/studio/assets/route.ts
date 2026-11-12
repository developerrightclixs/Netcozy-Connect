import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  session,
  sameOrigin,
  setSession,
  ServiceError,
} from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env.mjs";
import {
  validateEvidence,
  MAX_EVIDENCE_BYTES,
} from "@/features/real-estate/evidence.mjs";
import type { StudioAsset } from "@/features/studio/domain";
import { failure } from "@/features/real-estate/server-error";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const s = await session(request);
    const reader = request.body?.getReader();
    if (!reader) throw new ServiceError(400, "Select an image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EVIDENCE_BYTES + 65536) {
        await reader.cancel();
        throw new ServiceError(413, "Image must be at most 2 MB.");
      }
      chunks.push(value);
    }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const label = z.string().trim().min(3).max(120).parse(form.get("label"));
    const rights_note = z
      .string()
      .trim()
      .min(5)
      .max(500)
      .parse(form.get("rights_note"));
    if (form.get("acknowledge") !== "on")
      throw new ServiceError(400, "Confirm your rights to use this image.");
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !["image/png", "image/jpeg"].includes(file.type)
    )
      throw new ServiceError(
        400,
        "Select a PNG or JPEG image up to 2 MB. Video upload is unavailable.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      validateEvidence(bytes, file.type);
    } catch (e) {
      throw new ServiceError(400, (e as Error).message);
    }
    const asset = await s.client.rpc<StudioAsset>("studio_asset", {
      input: {
        action: "register",
        id: randomUUID(),
        label,
        rights_note,
        acknowledge: true,
        mime_type: file.type,
        byte_size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
    try {
      await s.client.uploadPrivate(
        "netcozy-studio-assets",
        asset.object_key,
        bytes,
        file.type,
      );
    } catch (e) {
      await s.client
        .rpc("studio_asset", {
          input: { action: "complete", id: asset.id, failed: true },
        })
        .catch(() => {});
      throw e;
    }
    const result = await s.client.rpc("studio_asset", {
      input: { action: "complete", id: asset.id },
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
export async function GET(request: NextRequest) {
  try {
    const s = await session(request);
    const id = z.uuid().parse(request.nextUrl.searchParams.get("id"));
    const asset = (
      await s.client.table<StudioAsset>("studio_assets", "id=eq." + id)
    )[0];
    if (!asset || asset.status !== "UPLOADED_UNSCANNED")
      throw new ServiceError(404, "Uploaded image not found.");
    const signed = await s.client.request<{ signedURL: string }>(
      "/storage/v1/object/sign/netcozy-studio-assets/" + asset.object_key,
      "POST",
      { expiresIn: 60 },
    );
    if (!signed.signedURL.startsWith("/object/sign/netcozy-studio-assets/"))
      throw new ServiceError(503, "Unexpected storage response.");
    const response = NextResponse.json(
      {
        url: supabaseConfig().url + "/storage/v1" + signed.signedURL,
        expiresIn: 60,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
