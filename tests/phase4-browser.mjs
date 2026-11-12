import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fixture } from "./fixtures/supabase.mjs";
const base = "http://127.0.0.1:3104",
  db = await fixture(4878);
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3104",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_URL: "http://127.0.0.1:4878",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
      APP_BASE_URL: base,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let browser,
  page,
  output = "";
const errors = [];
app.stdout.on("data", (c) => (output += c));
app.stderr.on("data", (c) => (output += c));
const post = (p, action, data) =>
  p.evaluate(
    async ({ action, data }) => {
      const r = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      return { status: r.status, body: await r.json() };
    },
    { action, data },
  );
const state = (p) =>
  p.evaluate(async () => {
    const r = await fetch("/api/studio");
    return r.json();
  });
async function account(email) {
  const p = await (
    await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  ).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/signup");
  for (const [action, data] of [
    ["signup", { email, password: "Phase4FixturePassword123!" }],
    ["verify", { email, token: "123456" }],
  ]) {
    assert.equal(
      await p.evaluate(
        async ({ action, data }) =>
          (
            await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, data }),
            })
          ).status,
        { action, data },
      ),
      200,
    );
  }
  return p;
}
async function tab(p, name) {
  await p
    .getByRole("navigation", { name: "Studio sections" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function saved(p) {
  await p
    .getByRole("status")
    .filter({ hasText: "Studio changes saved" })
    .waitFor();
}
async function open(p) {
  await p.goto(base + "/li3k-studio");
  await p
    .getByRole("heading", { name: "From your story to your next post." })
    .waitFor();
}
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const owner = (page = await account("studio-owner@example.test")),
    reviewer = await account("studio-reviewer@example.test"),
    other = await account("studio-other@example.test");
  await db.grantRole("studio-reviewer@example.test", "ADMIN");
  await open(owner);
  await owner
    .getByLabel("Business name", { exact: true })
    .fill("Demo Rewards Studio");
  await owner
    .getByLabel("Website (optional, HTTPS)")
    .fill("https://example.com");
  await owner.getByLabel("Industry", { exact: true }).fill("Hospitality");
  await owner
    .getByLabel("Audience", { exact: true })
    .fill("Local business owners looking for staff rewards");
  await owner
    .getByLabel("Offer & value")
    .fill("Employee rewards and curated local experiences");
  await owner
    .getByLabel("I am authorized to use this information", { exact: false })
    .check();
  await owner.getByRole("button", { name: "Save brand profile" }).click();
  await saved(owner);
  await tab(owner, "Creative library");
  await owner.getByLabel("Creative title").fill("Rewards launch story");
  await owner.getByLabel("Creative format").selectOption("IMAGE");
  await owner
    .getByLabel("Planned date & time (local, optional)")
    .fill("2027-01-12T10:30");
  await owner.getByRole("button", { name: "Prepare demo brief" }).click();
  await saved(owner);
  let current = (await state(owner)).creatives[0];
  assert.equal(current.source, "DEMO_TEMPLATE");
  assert.equal((await state(other)).creatives.length, 0);
  assert.equal((await post(owner, "publish", { id: current.id })).status, 409);
  assert.equal(
    (
      await post(owner, "export", {
        id: current.id,
        revision: current.revision,
      })
    ).status,
    403,
  );
  // Actual multipart UI upload, signature validation, private signed access and ownership.
  await tab(owner, "Media library");
  await owner.getByLabel("Image label").fill("Authorized demo artwork");
  await owner
    .getByLabel("Usage rights / source note")
    .fill("Self-created test artwork for browser verification");
  await owner.getByLabel("Image file", { exact: true }).setInputFiles({
    name: "demo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await owner
    .getByLabel("I have permission to use this image", { exact: false })
    .check();
  await owner.getByRole("button", { name: "Upload private image" }).click();
  await saved(owner);
  const asset = (await state(owner)).assets[0];
  assert.equal(asset.status, "UPLOADED_UNSCANNED");
  assert.equal(
    await other.evaluate(
      async (id) => (await fetch("/api/studio/assets?id=" + id)).status,
      asset.id,
    ),
    404,
  );
  await owner
    .getByRole("button", { name: "Prepare private image link" })
    .click();
  const assetLink = owner.getByRole("link", { name: "Open private image" });
  await assetLink.waitFor();
  assert.equal((await fetch(await assetLink.getAttribute("href"))).status, 200);
  await tab(owner, "Creative library");
  const card = owner
    .locator(".studio-card")
    .filter({ hasText: "Rewards launch story" });
  await card.getByLabel("Attach library image").selectOption(asset.id);
  await card.getByRole("button", { name: "Attach & reset review" }).click();
  await saved(owner);
  current = (await state(owner)).creatives[0];
  await card.getByRole("button", { name: "Submit for review" }).click();
  await saved(owner);
  assert.equal(
    (
      await post(owner, "review", {
        id: current.id,
        revision: current.revision,
        decision: "APPROVED",
        note: "Owner cannot approve",
        acknowledge: true,
      })
    ).status,
    403,
  );
  await open(reviewer);
  await tab(reviewer, "Review queue");
  const review = reviewer
    .locator(".studio-review")
    .filter({ hasText: "Rewards launch story" });
  await review
    .getByLabel("Review notes")
    .fill("Reviewed content, rights note and intended channel");
  await review.getByLabel("I reviewed this content", { exact: false }).check();
  await review.getByRole("button", { name: "Record review" }).click();
  await saved(reviewer);
  await open(owner);
  await tab(owner, "Creative library");
  const download = owner.waitForEvent("download");
  await owner.getByRole("button", { name: "Export reviewed package" }).click();
  const file = await download;
  assert.equal(file.suggestedFilename(), "li3k-reviewed-creative.json");
  await owner
    .getByRole("status")
    .filter({ hasText: "Reviewed package prepared" })
    .waitFor();
  await tab(owner, "Calendar");
  await owner
    .getByRole("heading", { name: "Content calendar", exact: true })
    .waitFor();
  assert.match(
    await owner.locator(".studio-calendar-row").innerText(),
    /Rewards launch story/,
  );
  await tab(owner, "Usage & reports");
  await owner.getByLabel("Period start").fill("2026-01-01");
  await owner.getByLabel("Period end").fill("2026-01-02");
  await owner.getByLabel("views", { exact: true }).fill("120");
  await owner
    .getByLabel("Aggregate source / evidence note")
    .fill("Authorized aggregate account report");
  await owner
    .getByLabel("These are manually reported", { exact: false })
    .check();
  await owner.getByRole("button", { name: "Record manual results" }).click();
  await saved(owner);
  assert.equal((await state(owner)).metrics[0].source, "MANUAL_UNVERIFIED");
  // Editing invalidates review, preserves export history, and remains usable on mobile.
  await tab(owner, "Creative library");
  await owner
    .locator(".studio-card")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await owner
    .getByLabel("Caption", { exact: true })
    .fill("A revised human-written marketing caption.");
  await owner.getByRole("button", { name: "Save revised draft" }).click();
  await saved(owner);
  current = (await state(owner)).creatives[0];
  assert.equal(current.status, "DRAFT");
  assert.equal(
    (
      await post(owner, "export", {
        id: current.id,
        revision: current.revision,
      })
    ).status,
    403,
  );
  await owner.screenshot({
    path: ".npm-cache/phase4-desktop.png",
    fullPage: true,
  });
  await owner.setViewportSize({ width: 390, height: 844 });
  for (const name of [
    "Brand & audience",
    "Creative library",
    "Media library",
    "Calendar",
    "Review queue",
    "Usage & reports",
  ]) {
    await tab(owner, name);
    assert.ok(
      await owner.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Mobile overflow on " + name,
    );
  }
  await owner.screenshot({
    path: ".npm-cache/phase4-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await other.evaluate(async () => (await fetch("/api/operations")).status),
    403,
  );
  const ops = await reviewer.evaluate(async () => {
    const r = await fetch("/api/operations");
    return { status: r.status, body: await r.json() };
  });
  assert.equal(ops.status, 200);
  assert.ok(ops.body.checks.every((c) => c.status === "REACHABLE"));
  const health = await fetch(base + "/api/health");
  assert.match(
    health.headers.get("Content-Security-Policy"),
    /object-src 'none'/,
  );
  assert.equal((await health.json()).scope, "liveness-only");
  const origin = await owner.request.post(base + "/api/studio", {
    headers: { Origin: "https://untrusted.example" },
    data: {
      action: "export",
      data: { id: current.id, revision: current.revision },
    },
  });
  assert.equal(origin.status(), 403);
  const oversized = await owner.request.post(base + "/api/studio", {
    headers: { Origin: base, "Content-Type": "application/json" },
    data: "x".repeat(33000),
  });
  assert.equal(oversized.status(), 413);
  const malformed = await owner.request.post(base + "/api/studio", {
    headers: { Origin: base, "Content-Type": "application/json" },
    data: "{invalid-json",
  });
  assert.equal(malformed.status(), 400);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Phase 4 browser brand setup, demo preparation, private image upload/access, attachment review invalidation, independent review, manual export, calendar, manual reports, edit invalidation, ownership, blocked publishing, request bounds/origin, operational access, headers and mobile layout. Simulated Auth/Storage HTTP; real SQL/RLS.",
  );
} catch (e) {
  if (page) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({
      path: ".npm-cache/phase4-failure.png",
      fullPage: true,
    });
  }
  console.error(e);
  console.error(output.slice(-2500));
  process.exitCode = 1;
} finally {
  await browser?.close();
  app.kill();
  app.stdout.destroy();
  app.stderr.destroy();
  await db.close();
}
