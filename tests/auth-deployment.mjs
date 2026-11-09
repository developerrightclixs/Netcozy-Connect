import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const base = "http://127.0.0.1:3102";
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3102",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      APP_BASE_URL: base,
      NODE_ENV: "production",
    },
    stdio: "ignore",
  },
);
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base + "/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, "Application did not start");
  const response = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      data: {
        email: "configuration@example.test",
        password: "TestPassword123!",
      },
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "AUTH_CONFIGURATION");
  assert.match(body.error, /SUPABASE_URL/);
  assert.doesNotMatch(body.error, /Check your email, password/);
  console.log(
    "PASS: compiled deployment returns AUTH_CONFIGURATION / HTTP 503 for missing server environment, without blaming credentials.",
  );
} finally {
  app.kill();
}
