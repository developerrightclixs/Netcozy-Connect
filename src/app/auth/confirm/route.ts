import { NextRequest, NextResponse } from "next/server";
import { Supabase, setSession, type Tokens } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  if (
    !token ||
    token.length > 500 ||
    request.nextUrl.searchParams.get("type") !== "email"
  )
    return NextResponse.redirect(
      new URL("/login?error=confirmation", request.url),
    );
  try {
    const tokens = await new Supabase().request<Tokens>(
      "/auth/v1/verify",
      "POST",
      { token_hash: token, type: "email" },
    );
    const response = NextResponse.redirect(new URL("/onboarding", request.url));
    setSession(response, tokens);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=confirmation", request.url),
    );
  }
}
