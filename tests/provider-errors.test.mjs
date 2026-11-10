import test from "node:test";
import assert from "node:assert/strict";
import { providerAuthFailure } from "../src/features/auth/provider-errors.mjs";

test("signup provider failures explain SMTP and disabled signup safely", () => {
  for (const [code, pattern] of [
    ["email_address_not_authorized", /custom SMTP/],
    ["signup_disabled", /signup is disabled/],
    ["email_provider_disabled", /Email provider/],
    ["weak_password", /stronger password/],
    ["captcha_failed", /CAPTCHA/],
  ]) {
    const result = providerAuthFailure(
      { code, msg: "private@example.com" },
      422,
    );
    assert.match(result.message, pattern);
    assert.equal(result.code, "AUTH_" + code.toUpperCase());
    assert.doesNotMatch(result.message, /private@example/);
  }
});

test("unknown provider payloads are redacted and server errors remain server errors", () => {
  for (const payload of [
    null,
    { code: "private-token", message: "secret" },
    { code: "constructor" },
  ]) {
    const result = providerAuthFailure(payload, 500);
    assert.equal(result.status, 503);
    assert.equal(result.code, "AUTH_PROVIDER");
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-token|secret|constructor/,
    );
  }
  assert.equal(
    providerAuthFailure({ error_code: "invalid_credentials" }, 401).code,
    "AUTH_INVALID_CREDENTIALS",
  );
});
