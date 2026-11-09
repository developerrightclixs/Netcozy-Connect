import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { authFailure } from "../src/features/auth/errors.mjs";
import {
  supabaseConfig,
  applicationOrigin,
  ConfigurationError,
} from "../src/lib/env.mjs";
const failure = (schema, input) => {
  const result = schema.safeParse(input);
  assert.equal(result.success, false);
  return authFailure(result.error);
};
test("missing deployment configuration is a server error, not incorrect credentials", () => {
  try {
    supabaseConfig({});
    assert.fail("Configuration should fail");
  } catch (error) {
    assert.ok(error instanceof ConfigurationError);
    const result = authFailure(error);
    assert.equal(result.status, 503);
    assert.equal(result.code, "AUTH_CONFIGURATION");
    assert.match(result.error, /SUPABASE_URL/);
  }
});
test("invalid email and weak password give specific field errors without submitted values", () => {
  assert.equal(
    failure(z.object({ email: z.string().email() }), {
      email: "private-invalid-value",
    }).error,
    "Enter a valid email address.",
  );
  assert.match(
    failure(z.object({ password: z.string().min(12) }), { password: "private" })
      .error,
    /at least 12/,
  );
  assert.doesNotMatch(
    failure(z.object({ password: z.string().min(12) }), { password: "private" })
      .error,
    /private/,
  );
  assert.match(
    failure(z.object({ password: z.string().max(128) }), {
      password: "x".repeat(129),
    }).error,
    /128/,
  );
});
test("unexpected errors and malformed JSON do not disclose internal details", () => {
  const result = authFailure(new Error("private-token postgres://sensitive"));
  assert.equal(result.status, 500);
  assert.equal(result.code, "AUTH_UNEXPECTED");
  assert.doesNotMatch(result.error, /private-token|postgres/);
  assert.equal(authFailure(new SyntaxError("private payload")).status, 400);
});
test("application origin validates server configuration without leaking its contents", () => {
  assert.equal(
    applicationOrigin("https://preview.example", {}),
    "https://preview.example",
  );
  assert.equal(
    applicationOrigin("http://localhost:3000", {
      APP_BASE_URL: "https://live.example/",
    }),
    "https://live.example",
  );
  for (const value of [
    "broken",
    "https://user:private-token@example.com",
    "https://live.example/path",
    "http://public.example",
  ]) {
    assert.throws(
      () =>
        applicationOrigin("https://fallback.example", { APP_BASE_URL: value }),
      (error) =>
        error instanceof ConfigurationError &&
        !error.message.includes("private-token"),
    );
  }
});
