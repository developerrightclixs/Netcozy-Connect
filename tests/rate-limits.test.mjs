import test from "node:test";
import assert from "node:assert/strict";
import { rateLimitDetails } from "../src/features/auth/rate-limits.mjs";
test("email limits are distinct and preserve upstream retry seconds", () => {
  const detail = rateLimitDetails("over_email_send_rate_limit", "120");
  assert.equal(detail.code, "AUTH_EMAIL_RATE_LIMITED");
  assert.equal(detail.retryAfterSeconds, 120);
  assert.match(detail.message, /inbox/);
});
test("general request limits do not falsely report an email quota", () => {
  const detail = rateLimitDetails("over_request_rate_limit", "15");
  assert.equal(detail.code, "AUTH_RATE_LIMITED");
  assert.equal(detail.retryAfterSeconds, 15);
});
test("HTTP date Retry-After is preserved as remaining seconds", () => {
  const now = Date.parse("2026-11-10T00:00:00Z");
  assert.equal(
    rateLimitDetails(null, "Tue, 10 Nov 2026 00:02:00 GMT", now)
      .retryAfterSeconds,
    120,
  );
});
test("missing and invalid headers do not invent a provider reset time", () => {
  for (const value of [
    null,
    "",
    "invalid",
    "-1",
    "0",
    "1.5",
    "999999999999999999999",
  ])
    assert.equal(rateLimitDetails(null, value).retryAfterSeconds, undefined);
});
test("unrecognized provider payloads cannot leak credentials into user messages", () => {
  const detail = rateLimitDetails("private-token:password", "not-a-date");
  assert.equal(detail.code, "AUTH_RATE_LIMITED");
  assert.doesNotMatch(JSON.stringify(detail), /private-token|password/);
});
