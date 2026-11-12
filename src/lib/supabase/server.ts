import { rateLimitDetails } from "@/features/auth/rate-limits.mjs";
import { providerAuthFailure } from "@/features/auth/provider-errors.mjs";
import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseConfig, applicationOrigin } from "../env.mjs";
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
};
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: AuthUser;
};
export class Supabase {
  private config = supabaseConfig();
  constructor(public token?: string) {}
  async uploadEvidence(key: string, bytes: Uint8Array, mime: string) {
    return this.uploadPrivate("netcozy-property-evidence", key, bytes, mime);
  }
  async uploadPrivate(
    bucket: "netcozy-property-evidence" | "netcozy-studio-assets",
    key: string,
    bytes: Uint8Array,
    mime: string,
  ) {
    let response: Response;
    try {
      response = await fetch(
        this.config.url + "/storage/v1/object/" + bucket + "/" + key,
        {
          method: "POST",
          headers: {
            apikey: this.config.publishableKey,
            Authorization: "Bearer " + this.token,
            "Content-Type": mime,
            "x-upsert": "false",
          },
          body: bytes as BodyInit,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new ServiceError(503, "Private evidence storage is unavailable.");
    }
    if (!response.ok)
      throw new ServiceError(
        400,
        "Evidence upload was rejected. Check private bucket setup and permissions.",
      );
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.config.url + path, {
        method,
        headers: {
          apikey: this.config.publishableKey,
          ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          Prefer: "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ServiceError(503, "Supabase is unavailable. Please try again.");
    }
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/auth/"))
        throw new ServiceError(401, "Please sign in again.");
      if (response.status === 429) {
        const payload = await response.json().catch(() => null);
        const details = rateLimitDetails(
          typeof payload?.code === "string"
            ? payload.code
            : payload?.error_code,
          response.headers.get("Retry-After"),
        );
        throw new ServiceError(
          429,
          path.startsWith("/auth/")
            ? details.message
            : "Too many requests. Please wait before trying again.",
          path.startsWith("/auth/") ? details.code : "RATE_LIMITED",
          details.retryAfterSeconds,
        );
      }
      if (path.startsWith("/auth/")) {
        const payload = await response.json().catch(() => null);
        const failure = providerAuthFailure(payload, response.status);
        throw new ServiceError(failure.status, failure.message, failure.code);
      }
      if (response.status === 404)
        throw new ServiceError(
          503,
          "Database setup is pending. Apply the reviewed development migrations for this workflow.",
        );
      throw new ServiceError(
        response.status === 403 ? 403 : 400,
        "The operation was rejected. Check permissions, consent and related records.",
      );
    }
    if (response.status === 204) return undefined as T;
    const value = await response.text();
    return (value ? JSON.parse(value) : undefined) as T;
  }
  table<T>(table: string, query = "", method = "GET", body?: unknown) {
    return this.request<T[]>(
      "/rest/v1/nc_" + table + (query ? "?" + query : ""),
      method,
      body,
    );
  }
  rpc<T>(name: string, body: unknown = {}) {
    return this.request<T>("/rest/v1/rpc/nc_" + name, "POST", body);
  }
}
export type Session = { client: Supabase; user: AuthUser; tokens?: Tokens };
export async function session(request: NextRequest): Promise<Session> {
  const access = request.cookies.get("nc-access")?.value;
  const refresh = request.cookies.get("nc-refresh")?.value;
  let client = new Supabase(access);
  let user: AuthUser | undefined;
  let tokens: Tokens | undefined;
  if (access) {
    try {
      user = await client.request<AuthUser>("/auth/v1/user");
    } catch (e) {
      if (!(e instanceof ServiceError) || ![400, 401].includes(e.status))
        throw e;
    }
  }
  if (!user && refresh) {
    tokens = await new Supabase().request<Tokens>(
      "/auth/v1/token?grant_type=refresh_token",
      "POST",
      { refresh_token: refresh },
    );
    client = new Supabase(tokens.access_token);
    user = await client.request<AuthUser>("/auth/v1/user");
  }
  if (!user || !user.email_confirmed_at)
    throw new ServiceError(
      401,
      "Sign in with a confirmed email address to continue.",
    );
  return { client, user, tokens };
}
export function setSession(response: NextResponse, tokens: Tokens) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  response.cookies.set("nc-access", tokens.access_token, base);
  response.cookies.set("nc-refresh", tokens.refresh_token, base);
}
export function clearSession(response: NextResponse) {
  for (const name of ["nc-access", "nc-refresh"])
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
}
export function sameOrigin(request: NextRequest) {
  const expected = applicationOrigin(request.nextUrl.origin);
  if (request.headers.get("origin") !== new URL(expected).origin)
    throw new ServiceError(403, "Request origin is not allowed.");
}
export type { Tokens };
