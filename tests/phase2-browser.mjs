import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fixture } from "./fixtures/supabase.mjs";
const base = "http://127.0.0.1:3102",
  testDb = await fixture(4876);
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
      SUPABASE_URL: "http://127.0.0.1:4876",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
      APP_BASE_URL: base,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "",
  browser,
  page,
  reviewer;
app.stdout.on("data", (c) => (output += c));
app.stderr.on("data", (c) => (output += c));
async function waitFor(check) {
  for (let n = 0; n < 100; n++) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Application startup timed out");
}
async function post(p, action, data, endpoint = "/api/real-estate") {
  return p.evaluate(
    async ({ action, data, endpoint }) => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      return { status: r.status, body: await r.json() };
    },
    { action, data, endpoint },
  );
}
async function get(p, path = "/api/real-estate") {
  return p.evaluate(async (path) => {
    const r = await fetch(path);
    return { status: r.status, body: await r.json() };
  }, path);
}
async function account(p, email) {
  await p.goto(base + "/signup");
  assert.equal(
    (
      await post(
        p,
        "signup",
        { email, password: "FixturePhase2Password123!" },
        "/api/auth",
      )
    ).status,
    200,
  );
  assert.equal(
    (await post(p, "verify", { email, token: "123456" }, "/api/auth")).status,
    200,
  );
}
async function saved(p) {
  await p
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .last()
    .waitFor();
}
try {
  await waitFor(async () => (await fetch(base)).ok);
  assert.equal((await fetch(base + "/api/real-estate")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/real-estate", {
        method: "POST",
        headers: {
          Origin: "https://outside.invalid",
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await account(page, "phase2-owner@example.test");
  await post(
    page,
    "consent",
    { purpose: "matching", channel: "platform", granted: true },
    "/api/core",
  );
  await page.goto(base + "/properties");
  await page.getByRole("tab", { name: "Imports", exact: true }).click();
  await page
    .getByLabel("CSV file", { exact: true })
    .setInputFiles("public/examples/vacant-lots-demo.csv");
  await page
    .getByRole("checkbox", { name: "I am authorized to import", exact: false })
    .check();
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "40 records ready for review" })
    .waitFor();
  await page.getByRole("button", { name: "Import reviewed records" }).click();
  await saved(page);
  await page.getByText(/COMPLETED.*Fictitious demo CSV.*40 rows/).waitFor();
  const csv = await fs.readFile("public/examples/vacant-lots-demo.csv", "utf8");
  const repeat = await post(page, "import", {
    csv,
    meta: {
      request_key: crypto.randomUUID(),
      source: "Fictitious demo CSV",
      license_evidence:
        "Fictitious sample records supplied for Netcozy demonstration only.",
      is_demo: true,
      attested: true,
    },
  });
  assert.equal(repeat.body.result.unchanged_count, 40);
  const dispositions = await get(
    page,
    "/api/real-estate?import=" + repeat.body.result.id,
  );
  assert.equal(dispositions.body.importRows.length, 40);
  assert.equal(dispositions.body.importRows[0].row_number, 2);
  assert.ok(
    dispositions.body.importRows.every((r) => r.disposition === "UNCHANGED"),
  );
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Page 2", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".npm-cache/phase2-gallery-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Search property address").fill("Demo Lot 001");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  // Use a guaranteed address from the fixture, then verify server-side search.
  let state = (await get(page)).body;
  const p =
    state.properties.find((p) => p.region === "Texas") ?? state.properties[0];
  await page.getByLabel("Search property address").fill(p.address);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const result = await get(
    page,
    "/api/real-estate?q=" + encodeURIComponent(p.address),
  );
  assert.equal(result.body.properties.length, 1);
  await page.locator(".property-choice").filter({ hasText: p.address }).click();
  await page
    .getByRole("heading", { name: "Private evidence", exact: true })
    .waitFor();
  await page
    .getByLabel("Demo evidence label", { exact: true })
    .fill("Fictitious title note");
  await page
    .getByLabel("Demo evidence note", { exact: true })
    .fill("This is fictitious evidence for the demo property only.");
  await page.getByRole("button", { name: "Add demo evidence" }).click();
  await saved(page);
  await page
    .getByLabel("Evidence for lot_acres", { exact: true })
    .selectOption({ label: "Fictitious title note (DEMO)" });
  const claimForm = page
    .getByLabel("Evidence for lot_acres", { exact: true })
    .locator("..")
    .locator("..");
  await claimForm.getByRole("button", { name: "Request claim review" }).click();
  await saved(page);
  await page
    .getByLabel("Evidence label", { exact: true })
    .fill("Private test PDF");
  await page.getByLabel("Evidence file", { exact: true }).setInputFiles({
    name: "evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 private demo fixture"),
  });
  await page.getByRole("button", { name: "Upload private evidence" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Evidence uploaded privately" })
    .waitFor();
  state = (await get(page, "/api/real-estate?property=" + p.id)).body;
  assert.equal(
    state.evidence.filter((e) => e.status === "UPLOADED_UNSCANNED").length,
    1,
  );
  const file = state.evidence.find((e) => e.status === "UPLOADED_UNSCANNED");
  const signed = await get(page, "/api/real-estate/evidence?id=" + file.id);
  assert.equal(signed.status, 200);
  assert.equal((await fetch(signed.body.url)).status, 200);
  const reviewerContext = await browser.newContext();
  await page
    .getByLabel("Contact name", { exact: true })
    .fill("Demo Owner Contact");
  await page
    .getByLabel("Contact email", { exact: true })
    .fill("owner-contact@example.test");
  await page
    .getByLabel("Contact source / authorization", { exact: true })
    .fill("Fictitious contact supplied for demo use only.");
  await page
    .getByRole("button", { name: "Save owner contact", exact: true })
    .click();
  await saved(page);
  await page
    .getByLabel("Permission evidence", { exact: true })
    .fill("Fictitious demo email permission.");
  await page
    .getByRole("button", { name: "Record permission", exact: true })
    .click();
  await saved(page);
  await page.getByLabel("Log channel", { exact: true }).selectOption("EMAIL");
  await page
    .getByLabel("Outreach notes", { exact: true })
    .fill("Manually recorded fictitious introduction.");
  await page
    .getByRole("checkbox", { name: "I manually performed", exact: false })
    .check();
  await page
    .getByRole("button", { name: "Save manual log", exact: true })
    .click();
  await saved(page);
  await page
    .getByLabel("Permission decision", { exact: true })
    .selectOption("withdraw");
  await page
    .getByRole("button", { name: "Record permission", exact: true })
    .click();
  await saved(page);
  state = (await get(page, "/api/real-estate?property=" + p.id)).body;
  assert.equal(state.outreach.length, 1);
  assert.ok(
    (
      await post(page, "outreach", {
        contact_id: state.contacts[0].id,
        channel: "EMAIL",
        notes: "Rejected after permission withdrawal",
        manual_attestation: true,
      })
    ).status >= 400,
  );
  reviewer = await reviewerContext.newPage();
  await account(reviewer, "phase2-reviewer@example.test");
  assert.equal(
    (await get(reviewer, "/api/real-estate?property=" + p.id)).status,
    404,
  );
  assert.equal(
    (await get(reviewer, "/api/real-estate/evidence?id=" + file.id)).status,
    404,
  );
  await testDb.promote("phase2-reviewer@example.test");
  await reviewer.goto(base + "/properties");
  await reviewer.getByRole("tab", { name: "Reviews", exact: true }).click();
  await reviewer.getByLabel("Claim decision").selectOption("VERIFIED");
  await reviewer
    .getByLabel("Claim review explanation")
    .fill("Reviewed fictitious demo evidence only.");
  await reviewer
    .getByRole("button", { name: "Record independent claim review" })
    .click();
  await saved(reviewer);
  await page.getByRole("tab", { name: "Partners", exact: true }).click();
  await page.getByRole("button", { name: "Load demo developers" }).click();
  await saved(page);
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await page
    .getByRole("heading", { name: "Developer matches", exact: true })
    .waitFor();
  const createForm = page
    .getByRole("button", { name: "Create partner form" })
    .first()
    .locator("..");
  await createForm
    .getByRole("combobox")
    .selectOption("f0000000-0000-4000-8000-000000000001");
  await createForm.getByRole("button", { name: "Create partner form" }).click();
  await saved(page);
  state = (await get(page)).body;
  let form = state.forms[0];
  assert.ok(form);
  assert.ok(
    (await post(page, "form-simulate", { id: form.id, demo_attestation: true }))
      .status >= 400,
  );
  assert.ok(
    (
      await post(page, "form-review", {
        id: form.id,
        decision: "APPROVED",
        note: "Attempt to bypass review",
        acknowledge_unverified: true,
      })
    ).status >= 400,
  );
  await page.getByRole("tab", { name: "Forms", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for independent review" })
    .click();
  await saved(page);
  await reviewer.reload();
  await reviewer.getByRole("tab", { name: "Reviews", exact: true }).click();
  await reviewer.getByLabel("Form decision").selectOption("APPROVED");
  await reviewer
    .getByLabel("Form review explanation")
    .fill("Reviewed form and demo verification disclosures.");
  await reviewer
    .getByRole("checkbox", {
      name: "I reviewed the verification disclosures",
      exact: false,
    })
    .check();
  await reviewer
    .getByRole("button", { name: "Record independent form review" })
    .click();
  await saved(reviewer);
  await page.reload();
  await page.getByRole("tab", { name: "Forms", exact: true }).click();
  await page.getByText("APPROVED", { exact: true }).first().waitFor();
  await page.getByText("Edit mapped form fields", { exact: true }).click();
  await page
    .getByLabel("site address", { exact: true })
    .fill("Edited fictitious site address");
  await page.getByRole("button", { name: "Save edited form" }).click();
  await saved(page);
  assert.ok(
    (await post(page, "form-simulate", { id: form.id, demo_attestation: true }))
      .status >= 400,
  );
  await page
    .getByRole("button", { name: "Submit for independent review" })
    .click();
  await saved(page);
  await reviewer.reload();
  await reviewer.getByRole("tab", { name: "Reviews", exact: true }).click();
  await reviewer.getByLabel("Form decision").selectOption("APPROVED");
  await reviewer
    .getByLabel("Form review explanation")
    .fill("Reviewed edited version with demo disclosures.");
  await reviewer
    .getByRole("checkbox", {
      name: "I reviewed the verification disclosures",
      exact: false,
    })
    .check();
  await reviewer
    .getByRole("button", { name: "Record independent form review" })
    .click();
  await saved(reviewer);
  await page.reload();
  await page.getByRole("tab", { name: "Forms", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I understand this creates a DEMO receipt",
      exact: false,
    })
    .check();
  await page
    .getByRole("button", { name: "Simulate approved delivery" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Simulation recorded. No message was sent." })
    .waitFor();
  state = (await get(page)).body;
  assert.equal(state.deliveries.length, 1);
  assert.equal(state.deliveries[0].mode, "DEMO");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: ".npm-cache/phase2-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: ".npm-cache/phase2-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Phase 2 browser import/preview/reimport, pagination/search, private upload and signed download, owner isolation, independent claim/form review, edit invalidation, blocked direct send, simulated receipt and mobile layout. Auth/Storage HTTP fixture; actual SQL/RLS.",
  );
} catch (e) {
  if (page) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({
      path: ".npm-cache/phase2-failure.png",
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
  await testDb.close();
}
