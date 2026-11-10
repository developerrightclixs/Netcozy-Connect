import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fixture } from "./fixtures/supabase.mjs";
const base = "http://127.0.0.1:3103",
  db = await fixture(4877);
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3103",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      SUPABASE_URL: "http://127.0.0.1:4877",
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
app.stdout.on("data", (c) => (output += c));
app.stderr.on("data", (c) => (output += c));
const errors = [];
async function wait(check) {
  for (let n = 0; n < 100; n++) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Timed out waiting for application");
}
async function post(p, action, data, endpoint = "/api/modules") {
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
async function state(p) {
  return p.evaluate(async () => {
    const r = await fetch("/api/modules");
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
    return body;
  });
}
async function account(email) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/signup");
  assert.equal(
    (
      await post(
        p,
        "signup",
        { email, password: "Phase3FixturePassword123!" },
        "/api/auth",
      )
    ).status,
    200,
  );
  assert.equal(
    (await post(p, "verify", { email, token: "123456" }, "/api/auth")).status,
    200,
  );
  return p;
}
async function saved(p) {
  await p
    .getByRole("status")
    .filter({ hasText: "Saved successfully" })
    .last()
    .waitFor();
}
async function tab(p, name) {
  await p.getByRole("tab", { name, exact: true }).click();
}
async function publish(reviewer, owner, listing) {
  assert.equal(
    (await post(owner, "listing-action", { id: listing.id, action: "submit" }))
      .status,
    200,
  );
  assert.equal(
    (
      await post(reviewer, "listing-action", {
        id: listing.id,
        action: "review",
        decision: "PUBLISHED",
        note: "Independent browser test content review",
        acknowledge: true,
      })
    ).status,
    200,
  );
}
async function reviewUI(p, title) {
  await p.goto(base + "/talent");
  await tab(p, "Reviews");
  const card = p.locator(".claim-row").filter({ hasText: title });
  await card.getByLabel("Publication decision").selectOption("PUBLISHED");
  await card
    .getByLabel("Publication review note")
    .fill("Independently reviewed fictitious facts and disclosures.");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Record publication review" }).click();
  await saved(p);
}
const draft = {
  title: "Browser example listing",
  region: "Texas",
  summary: "Fictitious module workflow for local browser acceptance only.",
  price_minor: 4500,
  currency: "USD",
  is_demo: true,
  agent_id: null,
};
const starts = new Date(Date.now() + 7 * 86400000).toISOString(),
  ends = new Date(Date.now() + 7 * 86400000 + 4 * 3600000).toISOString(),
  closes = new Date(Date.now() + 6 * 86400000).toISOString();
try {
  await wait(async () => (await fetch(base)).ok);
  assert.equal((await fetch(base + "/api/modules")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/modules", {
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
  const owner = await account("phase3-owner@example.test");
  page = owner;
  for (const role of ["RECRUITER", "SELLER", "ORGANIZER"])
    await db.grantRole("phase3-owner@example.test", role);
  const reviewer = await account("phase3-reviewer@example.test");
  await db.promote("phase3-reviewer@example.test");
  await post(
    owner,
    "consent",
    { purpose: "matching", channel: "platform", granted: true },
    "/api/core",
  );
  await owner.goto(base + "/talent");
  await tab(owner, "Your listings");
  let form = owner
    .getByRole("heading", { name: "Create a listing", exact: true })
    .locator("..");
  await form
    .getByLabel("Listing title", { exact: true })
    .fill("Browser QA testers");
  await form.getByLabel("Listing region", { exact: true }).fill("Texas");
  await form
    .getByLabel("Listing description", { exact: true })
    .fill(draft.summary);
  await form.getByLabel("Opportunity kind").selectOption("TESTER");
  await form
    .getByLabel("Required skills (comma separated)")
    .fill("mobile QA, usability");
  await form.getByLabel("Remote opportunity").check();
  await form
    .getByLabel("Engagement / compensation terms")
    .fill("Fictitious paid tester project");
  await form.getByLabel("Compensation amount").fill("250");
  await form.getByRole("button", { name: "Save listing draft" }).click();
  await saved(owner);
  let job = (await state(owner)).owned.find(
    (l) => l.title === "Browser QA testers",
  );
  assert.ok(job);
  await owner
    .getByRole("button", { name: "Submit listing for review" })
    .click();
  await saved(owner);
  assert.ok(
    (
      await post(owner, "listing-action", {
        id: job.id,
        action: "review",
        decision: "PUBLISHED",
        note: "Attempted self approval",
        acknowledge: true,
      })
    ).status >= 400,
  );
  await reviewUI(reviewer, "Browser QA testers");
  const applicant = await account("phase3-applicant@example.test");
  page = applicant;
  await post(
    applicant,
    "consent",
    { purpose: "matching", channel: "platform", granted: true },
    "/api/core",
  );
  await applicant.goto(base + "/talent");
  await tab(applicant, "Talent profile");
  await applicant
    .getByLabel("Talent display name")
    .fill("Browser Candidate (Demo)");
  await applicant.getByLabel("Talent headline").fill("Mobile QA tester");
  await applicant.getByLabel("Talent region").fill("Texas");
  await applicant
    .getByLabel("Talent skills (comma separated)")
    .fill("mobile QA, usability");
  await applicant.getByLabel("Available for remote work").check();
  await applicant
    .getByRole("checkbox", { name: "Publish my talent profile", exact: false })
    .check();
  await applicant
    .getByRole("checkbox", { name: "I consent to make these", exact: false })
    .check();
  await applicant.getByRole("button", { name: "Save talent profile" }).click();
  await saved(applicant);
  await tab(applicant, "Browse");
  await applicant.getByRole("button", { name: /Browser QA testers/ }).click();
  await applicant
    .getByLabel("Application message")
    .fill("I consent to this fictitious tester application.");
  await applicant.getByRole("button", { name: "Apply to opportunity" }).click();
  await saved(applicant);
  await owner.goto(base + "/talent");
  await tab(owner, "Inbox");
  await owner.getByRole("button", { name: "Shortlist application" }).click();
  await saved(owner);
  assert.equal((await state(owner)).applications[0].status, "SHORTLISTED");
  await tab(owner, "Matching");
  await owner
    .getByRole("heading", {
      name: "Browser Candidate (Demo) · 100% fit",
      exact: true,
    })
    .waitFor();
  await post(
    applicant,
    "consent",
    { purpose: "matching", channel: "platform", granted: false },
    "/api/core",
  );
  const application = (await state(applicant)).applications[0];
  assert.ok(
    (
      await post(owner, "application-action", {
        id: application.id,
        status: "SHORTLISTED",
      })
    ).status >= 400,
  );
  await post(
    applicant,
    "consent",
    { purpose: "matching", channel: "platform", granted: true },
    "/api/core",
  );
  const agent = await account("phase3-agent@example.test");
  await db.grantRole("phase3-agent@example.test", "AGENT");
  await agent.goto(base + "/marketplace");
  await tab(agent, "Agent profile");
  await agent
    .getByLabel("Agent display name")
    .fill("Browser Marine Agent (Demo)");
  await agent.getByLabel("Agent business name").fill("Fictitious agency");
  await agent
    .getByRole("checkbox", { name: "I opt in to receive", exact: false })
    .check();
  await agent.getByRole("button", { name: "Save agent preferences" }).click();
  await saved(agent);
  const agentId = (await state(agent)).userId;
  await owner.goto(base + "/marketplace");
  await tab(owner, "Your listings");
  form = owner
    .getByRole("heading", { name: "Create a listing", exact: true })
    .locator("..");
  await form.getByLabel("Listing title").fill("Browser demo yacht");
  await form.getByLabel("Listing region").fill("Florida");
  await form.getByLabel("Listing description").fill(draft.summary);
  await form.getByLabel("Length (metres)").fill("42");
  await form.getByLabel("Build year").fill("2019");
  await form.getByLabel("Guest capacity").fill("12");
  await form.getByLabel("Assigned agent").selectOption(agentId);
  await form.getByRole("button", { name: "Save listing draft" }).click();
  await saved(owner);
  let yacht = (await state(owner)).owned.find(
    (l) => l.title === "Browser demo yacht",
  );
  assert.ok(
    (await post(owner, "listing-action", { id: yacht.id, action: "submit" }))
      .status >= 400,
  );
  await agent.goto(base + "/marketplace");
  await tab(agent, "Your listings");
  await agent.getByRole("button", { name: "Accept agent assignment" }).click();
  await saved(agent);
  await publish(reviewer, owner, yacht);
  await applicant.goto(base + "/marketplace");
  await applicant.getByRole("button", { name: /Browser demo yacht/ }).click();
  await applicant
    .getByLabel("Inquiry message")
    .fill("Please share details of this fictitious yacht.");
  await applicant
    .getByRole("checkbox", {
      name: "I consent to share this inquiry",
      exact: false,
    })
    .check();
  await applicant
    .getByRole("button", { name: "Request details", exact: true })
    .click();
  await saved(applicant);
  await agent.goto(base + "/marketplace");
  await tab(agent, "Inbox");
  await agent.getByRole("button", { name: "Accept inquiry" }).click();
  await saved(agent);
  assert.equal((await state(agent)).inquiries[0].status, "ACCEPTED");
  for (const input of [
    {
      ...draft,
      title: "Browser demo aircraft",
      module: "AVIATION",
      agent_id: agentId,
      facts: {
        make: "Demo",
        model: "Test Jet",
        year: 2020,
        seats: 12,
        hours: 200,
        offer: "SALE",
      },
    },
    {
      ...draft,
      title: "Browser demo vehicle",
      module: "VEHICLE",
      facts: {
        make: "Sample",
        model: "EV",
        year: 2025,
        mileage_km: 100,
        fuel: "Electric",
        seller_type: "DEALER",
      },
    },
  ]) {
    const created = await post(owner, "listing-save", input);
    assert.equal(created.status, 200);
    if (input.agent_id)
      assert.equal(
        (
          await post(agent, "listing-action", {
            id: created.body.result.id,
            action: "accept-agent",
          })
        ).status,
        200,
      );
    await publish(reviewer, owner, created.body.result);
  }
  await applicant.goto(base + "/marketplace");
  await applicant.getByLabel("Marketplace category").selectOption("AVIATION");
  await applicant
    .getByRole("button", { name: /Browser demo aircraft/ })
    .waitFor();
  await applicant.getByLabel("Marketplace category").selectOption("VEHICLE");
  await applicant
    .getByRole("button", { name: /Browser demo vehicle/ })
    .waitFor();
  const eventInput = {
    ...draft,
    module: "EVENT",
    title: "Browser demo event",
    facts: {
      starts_at: starts,
      ends_at: ends,
      closes_at: closes,
      venue: "Fictitious demo hall",
      capacity: 1,
    },
  };
  const eventResult = await post(owner, "listing-save", eventInput);
  assert.equal(eventResult.status, 200);
  const event = eventResult.body.result;
  await publish(reviewer, owner, event);
  await applicant.goto(base + "/events");
  await applicant.getByRole("button", { name: /Browser demo event/ }).click();
  await applicant
    .getByRole("checkbox", { name: "I agree to register", exact: false })
    .check();
  await applicant
    .getByRole("checkbox", {
      name: "I understand this is DEMO checkout",
      exact: false,
    })
    .check();
  await applicant.getByRole("button", { name: "Simulate checkout" }).click();
  await applicant
    .getByRole("status")
    .filter({ hasText: "Registration recorded" })
    .waitFor();
  const buyer = await account("phase3-buyer@example.test");
  assert.equal((await state(buyer)).inquiries.length, 0);
  assert.ok(
    (
      await post(buyer, "register", {
        listing_id: event.id,
        request_key: crypto.randomUUID(),
        quantity: 1,
        attested: true,
        demo_attestation: true,
      })
    ).status >= 400,
  );
  await tab(applicant, "Tickets");
  await applicant
    .getByText("DEMO TICKET · NO REAL ADMISSION", { exact: true })
    .waitFor();
  const order = (await state(applicant)).orders.find(
    (o) => o.listing_id === event.id,
  );
  const ticket = (await state(applicant)).tickets.find(
    (t) => t.order_id === order.id,
  );
  assert.equal(order.mode, "DEMO");
  await applicant.evaluate(() => window.scrollTo(0, 0));
  await applicant.screenshot({
    path: ".npm-cache/phase3-desktop.png",
    fullPage: true,
  });
  await applicant.setViewportSize({ width: 390, height: 844 });
  await applicant.evaluate(() => window.scrollTo(0, 0));
  await applicant.screenshot({
    path: ".npm-cache/phase3-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await applicant.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await owner.goto(base + "/events");
  await tab(owner, "Tickets");
  await owner.getByLabel("Check-in event").selectOption(event.id);
  await owner
    .getByLabel("Ticket reference", { exact: true })
    .fill(ticket.reference);
  await owner.getByRole("button", { name: "Check in ticket" }).click();
  await saved(owner);
  assert.ok(
    (
      await post(owner, "checkin", {
        listing_id: event.id,
        reference: ticket.reference,
      })
    ).status >= 400,
  );
  const paid = await post(owner, "listing-save", {
    ...eventInput,
    title: "Live paid checkout boundary",
    is_demo: false,
  });
  assert.equal(paid.status, 200);
  await publish(reviewer, owner, paid.body.result);
  assert.ok(
    (
      await post(buyer, "register", {
        listing_id: paid.body.result.id,
        request_key: crypto.randomUUID(),
        quantity: 1,
        attested: true,
        demo_attestation: true,
      })
    ).status >= 400,
  );
  const free = await post(owner, "listing-save", {
    ...eventInput,
    title: "Free checkout boundary",
    is_demo: false,
    price_minor: 0,
  });
  assert.equal(free.status, 200);
  await publish(reviewer, owner, free.body.result);
  const freeOrder = await post(buyer, "register", {
    listing_id: free.body.result.id,
    request_key: crypto.randomUUID(),
    quantity: 1,
    attested: true,
    demo_attestation: false,
  });
  assert.equal(freeOrder.status, 200);
  assert.equal(freeOrder.body.result.mode, "FREE");
  assert.equal(
    (await post(buyer, "cancel-order", { id: freeOrder.body.result.id }))
      .status,
    200,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Phase 3 browser recruitment opt-in/apply/shortlist/withdrawal, independent publication, yacht agent acceptance and inquiry, aircraft/vehicle filters, event capacity/DEMO checkout/private ticket/single-use check-in, blocked live payment, free registration/cancellation and mobile layout. Simulated Auth; real SQL/RLS.",
  );
} catch (e) {
  if (page) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({
      path: ".npm-cache/phase3-failure.png",
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
