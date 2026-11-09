import test from "node:test";
import assert from "node:assert/strict";
import {
  rankMatches,
  defaultWeights,
  latestConsent,
  canDeliver,
  renderTemplate,
} from "../src/features/core/domain.ts";
const goal = {
  id: "goal",
  industry: "talent",
  intent: "hire",
  target_intent: "work",
  title: "Find testers",
  region: "Texas",
  skills: ["testing", "UX"],
  active: true,
};
const person = {
  id: "a",
  name: "Example (Demo)",
  headline: "Tester",
  industry: "talent",
  intent: "work",
  region: "texas",
  skills: ["Testing", "ux"],
  available: true,
  opted_in: true,
  is_demo: true,
};
test("scoring has explainable reasons, normalization and exact bounded score", () => {
  const [match] = rankMatches(goal, [person]);
  assert.equal(match.score, 100);
  assert.equal(match.reasons.length, 5);
});
test("industry, complementary intent, active goal and consent exclude ineligible records", () => {
  assert.equal(
    rankMatches(goal, [
      { ...person, industry: "vehicles" },
      { ...person, intent: "hire" },
      { ...person, opted_in: false },
    ]).length,
    0,
  );
  assert.equal(rankMatches({ ...goal, active: false }, [person]).length, 0);
});
test("ranking is deterministic across input order and does not inflate duplicate skills", () => {
  const p2 = { ...person, id: "b" };
  assert.deepEqual(
    rankMatches(goal, [p2, person]).map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(
    rankMatches({ ...goal, skills: ["testing", "testing", "UX"] }, [person])[0]
      .score,
    100,
  );
});
test("partial skill matches and changed admin weights affect ranking correctly", () => {
  const p = { ...person, skills: ["testing"], region: "Florida" };
  assert.equal(rankMatches(goal, [p])[0].score, 78);
  assert.equal(
    rankMatches(goal, [p], { ...defaultWeights, region: 0, skills: 0 })[0]
      .score,
    100,
  );
  assert.throws(() =>
    rankMatches(goal, [p], {
      industry: 0,
      intent: 0,
      region: 0,
      skills: 0,
      available: 0,
    }),
  );
});
test("latest explicit revocation wins and channels remain independent", () => {
  const events = [
    {
      id: "1",
      purpose: "matching",
      channel: "platform",
      granted: true,
      created_at: "2026-11-01",
    },
    {
      id: "2",
      purpose: "matching",
      channel: "platform",
      granted: false,
      created_at: "2026-11-02",
    },
  ];
  assert.equal(latestConsent(events, "matching", "platform"), false);
  assert.equal(latestConsent(events, "marketing", "sms"), false);
});
test("transport gates never enable automated social, SMS, WhatsApp or email sends", () => {
  for (const channel of ["linkedin", "sms", "whatsapp", "email"])
    assert.equal(canDeliver(channel, true, true, true), false);
  assert.equal(canDeliver("manual-social", true, false, true), false);
  assert.equal(canDeliver("manual-social", false, true, true), false);
  assert.equal(canDeliver("manual-social", true, true, false), false);
});
test("template rendering only fills supported merge fields", () =>
  assert.equal(
    renderTemplate("Hi {{name}}, {{goal}} / {{unknown}}", {
      name: "Alex",
      goal: "Find testers",
      industry: "talent",
    }),
    "Hi Alex, Find testers / {{unknown}}",
  ));
