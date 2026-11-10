import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  session,
  setSession,
  sameOrigin,
  ServiceError,
} from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env.mjs";
import {
  validateEvidence,
  MAX_EVIDENCE_BYTES,
} from "@/features/real-estate/evidence.mjs";
import type { Evidence } from "@/features/real-estate/domain";
import { failure } from "@/features/real-estate/server-error";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const s = await session(request);
    // Bound the stream before parsing multipart, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new ServiceError(400, "Select an evidence file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EVIDENCE_BYTES + 65536) {
        await reader.cancel();
        throw new ServiceError(413, "Evidence must be at most 2 MB.");
      }
      chunks.push(value);
    }
    const multipart = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      multipart.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Response(multipart, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const property_id = z.string().uuid().parse(form.get("property_id")),
      label = z.string().trim().min(3).max(120).parse(form.get("label"));
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ServiceError(400, "Select a PDF, PNG or JPEG.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      validateEvidence(bytes, file.type);
    } catch (e) {
      throw new ServiceError(400, (e as Error).message);
    }
    const doc = await s.client.rpc<Evidence>("register_property_evidence", {
      input: {
        id: randomUUID(),
        property_id,
        label,
        mime_type: file.type,
        byte_size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
    try {
      await s.client.uploadEvidence(doc.object_key!, bytes, file.type);
    } catch (e) {
      await s.client
        .rpc("complete_property_evidence", {
          input: { id: doc.id, failed: true },
        })
        .catch(() => {});
      throw e;
    }
    const result = await s.client.rpc("complete_property_evidence", {
      input: { id: doc.id },
    });
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
export async function GET(request: NextRequest) {
  try {
    const s = await session(request),
      id = z.string().uuid().parse(request.nextUrl.searchParams.get("id"));
    const doc = (
      await s.client.table<Evidence>("property_evidence", "id=eq." + id)
    )[0];
    if (!doc?.object_key || doc.status !== "UPLOADED_UNSCANNED")
      throw new ServiceError(404, "Uploaded evidence not found.");
    const signed = await s.client.request<{ signedURL: string }>(
      "/storage/v1/object/sign/netcozy-property-evidence/" + doc.object_key,
      "POST",
      { expiresIn: 60 },
    );
    if (!signed.signedURL.startsWith("/object/sign/netcozy-property-evidence/"))
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
