import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fixture } from "./fixtures/supabase.mjs";
const base = "http://127.0.0.1:3100";
const testDb = await fixture();
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_URL: "http://127.0.0.1:4874",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
      APP_BASE_URL: base,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
app.stdout.on("data", (c) => (output += c));
app.stderr.on("data", (c) => (output += c));
let browser, page;
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Timed out: " + label);
}
try {
  await waitFor(async () => {
    const r = await fetch(base);
    return r.ok;
  }, "application startup");
  const csrf = await fetch(base + "/api/core", {
    method: "POST",
    headers: {
      Origin: "https://outside.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "identity", data: {} }),
  });
  assert.equal(csrf.status, 403);
  const unauthorized = await fetch(base + "/api/core");
  assert.equal(unauthorized.status, 401);
  const invalidInput = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "signup",
      data: { email: "validation@example.test", password: "short" },
    }),
  });
  assert.equal(invalidInput.status, 400);
  const inputError = await invalidInput.json();
  assert.equal(inputError.code, "AUTH_INPUT");
  assert.match(inputError.error, /at least 12/);
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  let errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole("link", { name: "Get started", exact: false }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("phase1@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalFixturePassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("LocalFixturePassword123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your email" })
    .waitFor();
  await page
    .getByText("Confirm your email or resend a link", { exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("phase1@example.test");
  await page.getByLabel("Confirmation code").fill("123456");
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("link", { name: "Complete your profile" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Continue", exact: false }).click();
  await page.getByRole("button", { name: "Run demo identity check" }).click();
  await page.getByText("DEMO_PASSED", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: false }).click();
  await page.getByLabel("Display name", { exact: true }).fill("Alex Founder");
  await page.getByLabel("Region", { exact: true }).fill("Texas");
  await page.getByLabel("Skills, separated by commas").fill("testing, ux");
  await page.getByLabel("Your first goal").fill("Find product testers");
  await page
    .getByRole("checkbox", {
      name: "I opt in to platform matching",
      exact: false,
    })
    .check();
  await page
    .getByRole("button", { name: "Save profile & discover matches" })
    .click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Welcome, Alex." }).waitFor();
  await page
    .getByRole("link", { name: "Discover matches", exact: false })
    .click();
  await page.getByRole("heading", { name: "2 relevant matches" }).waitFor();
  assert.ok(
    (await page.getByText("FICTITIOUS DEMO", { exact: true }).count()) === 2,
  );
  await page
    .getByRole("button", { name: "Save match", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Saved ✓" }).waitFor();
  await page
    .getByRole("link", { name: "Profile & goals", exact: false })
    .click();
  await page.getByText("Add another goal", { exact: true }).click();
  const addGoal = page
    .locator("details")
    .filter({ hasText: "Add another goal" });
  await addGoal
    .getByLabel("Industry", { exact: true })
    .selectOption("business");
  await addGoal
    .getByLabel("Your intent", { exact: true })
    .selectOption("partner");
  await addGoal
    .getByLabel("Their intent", { exact: true })
    .selectOption("partner");
  await addGoal
    .getByLabel("Goal", { exact: true })
    .fill("Build business partnerships");
  await addGoal.getByLabel("Region", { exact: true }).fill("Texas");
  await addGoal.getByRole("button", { name: "Add goal", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .waitFor();
  await page
    .getByRole("link", { name: "Discover matches", exact: false })
    .click();
  await page.getByRole("heading", { name: "4 relevant matches" }).waitFor();
  await page.locator(".filter-bar select").selectOption("business");
  await page.getByRole("heading", { name: "2 relevant matches" }).waitFor();
  await page.getByLabel("Search name").fill("Business partnerships");
  await page.getByRole("button", { name: "Save search", exact: true }).click();
  await page
    .getByRole("button", { name: "Business partnerships", exact: true })
    .waitFor();
  await page.locator(".filter-bar select").selectOption("");
  await page.getByRole("heading", { name: "4 relevant matches" }).waitFor();
  await page
    .getByRole("button", { name: "Business partnerships", exact: true })
    .click();
  await page.getByRole("heading", { name: "2 relevant matches" }).waitFor();
  await page
    .getByRole("link", { name: "Prepare introduction" })
    .first()
    .click();
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await page.getByLabel("Your message", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "I reviewed this saved draft" })
    .click();
  await page.getByText("Reviewed", { exact: true }).waitFor();
  await page.getByLabel("Track in pipeline").selectOption("RECRUITMENT");
  await page.getByRole("button", { name: "Add to pipeline" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .waitFor();
  await page.getByRole("link", { name: "My pipeline" }).click();
  await page.getByLabel("Stage", { exact: true }).selectOption("SENT");
  await page
    .getByRole("checkbox", { name: "I am manually recording", exact: false })
    .check();
  await page.getByRole("button", { name: "Update stage" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .waitFor();
  await page.getByRole("link", { name: "Privacy & settings" }).click();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .waitFor();
  await page
    .getByRole("link", { name: "Discover matches", exact: false })
    .click();
  await page.getByRole("heading", { name: "0 relevant matches" }).waitFor();
  // Prove server-side consent, send and role guards cannot be bypassed by the UI.
  const checks = await page.evaluate(async () => {
    const post = async (action, data) => {
      const r = await fetch("/api/core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      return r.status;
    };
    return {
      send: await post("send", { channel: "whatsapp" }),
      role: await post("role", {
        user_id: "10000000-0000-4000-8000-000000000001",
        role: "ADMIN",
        remove: false,
      }),
    };
  });
  assert.equal(checks.send, 400);
  assert.equal(checks.role, 403);
  // A missing access token must refresh using the server-held refresh cookie.
  await context.clearCookies({ name: "nc-access" });
  await page.goto(base + "/dashboard");
  await page.getByRole("heading", { name: "Welcome, Alex." }).waitFor();
  const refreshed = await context.cookies();
  assert.ok(refreshed.find((c) => c.name === "nc-access")?.httpOnly);
  assert.ok(refreshed.find((c) => c.name === "nc-refresh")?.httpOnly);
  await testDb.promote("phase1@example.test");
  await page.goto(base + "/admin");
  await page.getByRole("heading", { name: "Members & roles" }).waitFor();
  await page.getByRole("heading", { name: "Matching weights" }).waitFor();
  await page.getByLabel("Template key", { exact: true }).fill("browser-test");
  await page.getByLabel("Title", { exact: true }).fill("Browser introduction");
  await page
    .getByLabel("Body", { exact: true })
    .fill("Hello {{name}}, let us discuss {{goal}}.");
  await page
    .getByRole("checkbox", { name: "Approve this version", exact: false })
    .check();
  await page.getByRole("button", { name: "Create template version" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/dashboard");
  await page.getByRole("heading", { name: "Welcome, Alex." }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: ".npm-cache/phase1-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".npm-cache/phase1-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  const cookies = await context.cookies();
  assert.equal(
    cookies.some((c) => c.name === "nc-access" || c.name === "nc-refresh"),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser + real server routes + PostgreSQL/RLS workflow (simulated Supabase Auth), consent revocation, blocked sends/role escalation, admin templates, mobile overflow, logout.",
  );
} catch (error) {
  if (page) {
    console.error("Test page:", await page.locator("body").innerText());
    await page.screenshot({
      path: ".npm-cache/browser-failure.png",
      fullPage: true,
    });
  }
  console.error(error);
  console.error(output.slice(-1800));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  app.kill();
  app.stdout.destroy();
  app.stderr.destroy();
  await testDb.close();
}
