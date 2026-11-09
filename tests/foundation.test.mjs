import test from "node:test";
import assert from "node:assert/strict";
import { supabaseConfig } from "../src/lib/env.mjs";
import { checkSupabase } from "../src/lib/supabase-check.mjs";
import config from "../next.config.mjs";
const valid = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
test("Supabase accepts hosted HTTPS and local HTTP origins", () => {
  assert.equal(supabaseConfig(valid).url, valid.SUPABASE_URL);
  assert.equal(
    supabaseConfig({ ...valid, SUPABASE_URL: "http://127.0.0.1:54321" }).url,
    "http://127.0.0.1:54321",
  );
});
test("invalid configuration and privileged keys fail without leaking values", () => {
  for (const input of [
    {},
    { ...valid, SUPABASE_URL: "http://example.com" },
    { ...valid, SUPABASE_URL: "https://user:private-secret@example.com" },
    { ...valid, SUPABASE_URL: "https://example.com/path" },
    { ...valid, SUPABASE_PUBLISHABLE_KEY: "sb_secret_private-secret" },
    { ...valid, SUPABASE_PUBLISHABLE_KEY: "eyJprivate-secret" },
  ]) {
    assert.throws(
      () => supabaseConfig(input),
      (error) => !error.message.includes("private-secret"),
    );
  }
});
test("provider probe is read-only, bounded and sends no bearer/secret key", async () => {
  let called = false;
  await checkSupabase(valid, async (url, options) => {
    called = true;
    assert.equal(url, valid.SUPABASE_URL + "/auth/v1/settings");
    assert.equal(options.method, "GET");
    assert.deepEqual(options.headers, {
      apikey: valid.SUPABASE_PUBLISHABLE_KEY,
    });
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true };
  });
  assert.ok(called);
});
test("provider failures never expose response bodies, credentials or network errors", async () => {
  for (const request of [
    async () => ({ ok: false }),
    async () => {
      throw new Error("private-secret");
    },
  ]) {
    await assert.rejects(
      checkSupabase(valid, request),
      (error) =>
        !error.message.includes("private-secret") &&
        error.message.startsWith("Supabase API check failed"),
    );
  }
});
test("all application routes receive baseline security headers", async () => {
  assert.equal(config.poweredByHeader, false);
  const [rule] = await config.headers();
  assert.equal(rule.source, "/:path*");
  const headers = Object.fromEntries(
    rule.headers.map(({ key, value }) => [key, value]),
  );
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(
    headers["Permissions-Policy"],
    "camera=(), microphone=(), geolocation=()",
  );
});
