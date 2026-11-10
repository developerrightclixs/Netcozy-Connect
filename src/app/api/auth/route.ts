import { authFailure } from "@/features/auth/errors.mjs";
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
    const body = z
      .object({
        action: z.enum(["login", "signup", "logout", "verify", "resend"]),
        data: z.unknown().optional(),
      })
      .strict()
      .parse(await request.json());
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
          email: z.string().trim().email().max(254),
          token: z.string().regex(/^[0-9]{6,10}$/),
        })
        .parse(body.data);
      const tokens = await client.request<Tokens>("/auth/v1/verify", "POST", {
        ...input,
        type: "email",
      });
      response = NextResponse.json({ ok: true });
      setSession(response, tokens);
      return response;
    }
    if (!["login", "signup", "resend"].includes(body.action))
      throw new ServiceError(400, "Unknown authentication action.");
    if (body.action === "resend") {
      const { email } = z
        .object({ email: z.string().trim().email() })
        .parse(body.data);
      await client.request("/auth/v1/resend", "POST", {
        type: "signup",
        email,
      });
      return NextResponse.json({
        ok: true,
        message:
          "If eligible, a new verification code has been emailed. Enter the newest code below.",
      });
    }
    const input = (body.action === "signup" ? authSchema : loginSchema).parse(
      body.data,
    );
    const settings = await client.request<{ mailer_autoconfirm?: boolean }>(
      "/auth/v1/settings",
    );
    if (settings.mailer_autoconfirm)
      throw new ServiceError(
        503,
        "Enable email confirmation in your Supabase Auth settings before using this application.",
      );
    if (body.action === "signup") {
      await client.request("/auth/v1/signup", "POST", input);
      return NextResponse.json({
        ok: true,
        message:
          "Check your email for your verification code. Enter it below to confirm your email and sign in.",
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
    const failure =
      e instanceof ServiceError
        ? {
            status: e.status,
            code: e.code ?? "AUTH_PROVIDER",
            error: e.message,
          }
        : authFailure(e);
    if (failure.status >= 500 || failure.status === 429)
      console.error(
        JSON.stringify({
          event: "authentication_failed",
          code: failure.code,
          errorType: e instanceof Error ? e.name : "Unknown",
        }),
      );
    const retryAfterSeconds =
      e instanceof ServiceError ? e.retryAfterSeconds : undefined;
    return NextResponse.json(
      {
        error: failure.error,
        code: failure.code,
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      },
      {
        status: failure.status,
        headers: {
          "Cache-Control": "no-store",
          ...(retryAfterSeconds
            ? { "Retry-After": String(retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
