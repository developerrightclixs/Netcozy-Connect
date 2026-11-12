import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
// Liveness only. Never expose configuration, versions, users or provider errors.
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "netcozy-connect", scope: "liveness-only" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
