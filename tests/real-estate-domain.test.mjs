import test from "node:test";
import assert from "node:assert/strict";
import {
  rankDevelopers,
  propertySchema,
  partnerTemplateSchema,
} from "../src/features/real-estate/domain.ts";
const property = {
  id: "property",
  region: "Texas",
  lot_acres: 5,
  asking_price: 100000,
  zoning: "Residential",
  listing_status: "AVAILABLE",
  is_demo: true,
};
const developer = {
  id: "b",
  name: "Demo",
  region: " texas ",
  min_acres: 1,
  max_acres: 20,
  max_price: 200000,
  zoning: ["Residential"],
  active: true,
  is_demo: true,
};
test("developer scoring explains preferences and excludes ineligible records", () => {
  assert.equal(
    rankDevelopers(
      { ...property, lot_acres: "3.500", asking_price: "75000.00" },
      [
        {
          ...developer,
          min_acres: "1.000",
          max_acres: "20.000",
          max_price: "200000.00",
        },
      ],
      [],
      true,
    ).length,
    1,
  );
  const ranked = rankDevelopers(
    property,
    [developer, { ...developer, id: "a" }],
    [],
    true,
  );
  assert.equal(ranked[0].id, "a");
  assert.equal(ranked[0].score, 90);
  assert.equal(ranked[0].unverified, true);
  assert.ok(ranked[0].reasons.some((r) => r.includes("Zoning")));
  for (const changes of [
    { region: "Florida" },
    { max_price: 999 },
    { max_acres: 1 },
    { min_acres: 10 },
    { active: false },
    { is_demo: false },
  ])
    assert.equal(
      rankDevelopers(property, [{ ...developer, ...changes }], [], true).length,
      0,
    );
  assert.deepEqual(rankDevelopers(property, [developer], [], false), []);
  assert.deepEqual(
    rankDevelopers(
      { ...property, listing_status: "CLOSED" },
      [developer],
      [],
      true,
    ),
    [],
  );
  assert.equal(
    rankDevelopers(
      property,
      [developer],
      Array.from({ length: 8 }, (_, i) => ({
        property_id: "property",
        claim_key: String(i),
        status: "VERIFIED",
      })),
      true,
    )[0].score,
    100,
  );
});
test("property validation rejects missing provenance and template mappings outside allowlist", () => {
  assert.equal(
    propertySchema.safeParse({
      ...property,
      address: "Demo land",
      source: "demo",
      license_evidence: "demo supplied",
      attested: false,
    }).success,
    false,
  );
  assert.equal(
    partnerTemplateSchema.safeParse({
      partner_id: "10000000-0000-4000-8000-000000000001",
      template_key: "test",
      version: 1,
      title: "Test template",
      field_mapping: { field: null },
      approved: true,
    }).success,
    false,
  );
});
