import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  Supabase,
  session,
  setSession,
  clearSession,
  sameOrigin,
  ServiceError,
  type Tokens,
} from "@/lib/supabase/server";
import { authSchema, loginSchema } from "@/features/core/validation";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const client = new Supabase();
    let response: NextResponse;
    if (body.action === "logout") {
      // Provider logout revokes the refresh session; cookies are cleared even if the session expired.
      try {
        const s = await session(request);
        await s.client.request("/auth/v1/logout", "POST");
      } catch {}
      response = NextResponse.json({ ok: true });
      clearSession(response);
      return response;
    }
    if (body.action === "verify") {
      const input = z
        .object({
          email: z.string().email(),
          token: z.string().regex(/^[0-9]{6,10}$/),
        })
        .parse(body.data);
      const tokens = await client.request<Tokens>("/auth/v1/verify", "POST", {
        ...input,
        type: "signup",
      });
      response = NextResponse.json({ ok: true });
      setSession(response, tokens);
      return response;
    }
    if (!["login", "signup", "resend"].includes(body.action))
      throw new ServiceError(400, "Unknown authentication action.");
    if (body.action === "resend") {
      const email = z.string().email().parse(body.data?.email);
      await client.request("/auth/v1/resend", "POST", {
        type: "signup",
        email,
      });
      return NextResponse.json({
        ok: true,
        message: "If eligible, a confirmation email has been sent.",
      });
    }
    const settings = await client.request<{ mailer_autoconfirm?: boolean }>(
      "/auth/v1/settings",
    );
    if (settings.mailer_autoconfirm)
      throw new ServiceError(
        503,
        "Enable email confirmation in your Supabase Auth settings before using this application.",
      );
    const input = (body.action === "signup" ? authSchema : loginSchema).parse(
      body.data,
    );
    if (body.action === "signup") {
      await client.request("/auth/v1/signup", "POST", input);
      return NextResponse.json({
        ok: true,
        message:
          "Check your email for the confirmation link. Then sign in, or enter the code if your email template includes one.",
      });
    }
    const tokens = await client.request<Tokens>(
      "/auth/v1/token?grant_type=password",
      "POST",
      input,
    );
    if (!tokens.user?.email_confirmed_at)
      throw new ServiceError(401, "Confirm your email address first.");
    response = NextResponse.json({ ok: true });
    setSession(response, tokens);
    return response;
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 400;
    return NextResponse.json(
      {
        error:
          e instanceof ServiceError
            ? e.message
            : "Check your email, password and input fields.",
      },
      { status },
    );
  }
}
