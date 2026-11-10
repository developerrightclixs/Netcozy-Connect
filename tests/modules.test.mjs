import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database } from "./fixtures/database.mjs";
import {
  rankCandidates,
  listingSchema,
} from "../src/features/modules/domain.ts";
const A = "31000000-0000-4000-8000-000000000001",
  B = "31000000-0000-4000-8000-000000000002",
  C = "31000000-0000-4000-8000-000000000003",
  D = "31000000-0000-4000-8000-000000000004",
  E = "31000000-0000-4000-8000-000000000005";
const candidate = {
  name: "Test Candidate",
  headline: "Mobile QA tester",
  region: "Texas",
  skills: ["mobile QA", "usability"],
  kind: "TESTER",
  remote: true,
  available: true,
  bio: "Self supplied test profile",
  discoverable: true,
  is_demo: true,
  attested: true,
};
const base = {
  title: "A test listing",
  region: "Texas",
  summary: "Authorized fictitious listing for tests only.",
  price_minor: 1000,
  currency: "USD",
  is_demo: true,
  agent_id: null,
};
const job = {
  ...base,
  module: "TALENT",
  facts: {
    kind: "TESTER",
    skills: ["mobile QA", "usability"],
    remote: true,
    engagement: "Fictitious test project",
  },
};
const event = {
  ...base,
  module: "EVENT",
  price_minor: 4500,
  facts: {
    starts_at: "2027-05-01T18:00:00Z",
    ends_at: "2027-05-01T22:00:00Z",
    closes_at: "2027-05-01T17:00:00Z",
    venue: "Fictitious test venue",
    capacity: 2,
  },
};
test("Phase 3 ranking is deterministic, consent-bound and mode/kind/location filtered", () => {
  const listing = { ...job, id: "job" };
  const ranked = rankCandidates(
    listing,
    [
      { ...candidate, id: "b" },
      { ...candidate, id: "a" },
    ],
    true,
  );
  assert.equal(ranked[0].id, "a");
  assert.equal(ranked[0].score, 100);
  assert.match(ranked[0].reasons.join(" "), /mobile qa/i);
  for (const change of [
    { available: false },
    { discoverable: false },
    { is_demo: false },
    { kind: "JOB" },
    { region: "Florida", remote: false },
  ])
    assert.equal(
      rankCandidates(listing, [{ ...candidate, id: "a", ...change }], true)
        .length,
      0,
    );
  assert.deepEqual(rankCandidates(listing, [candidate], false), []);
  assert.equal(
    listingSchema.safeParse({
      ...job,
      facts: { ...job.facts, password: "secret" },
    }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({
      ...event,
      facts: { ...event.facts, capacity: 0 },
    }).success,
    false,
  );
});
test("Phase 3 actual PostgreSQL roles, consent, reviews, agents, inquiries and ticket transactions", async (t) => {
  const db = await database();
  const root = async (sql, args = []) => {
    await db.exec("reset role");
    return db.query(sql, args);
  };
  const as = async (user, sql, args = []) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec("set role authenticated");
    return db.query(sql, args);
  };
  const rpc = async (user, name, input) =>
    (
      await as(user, "select nc_" + name + "($1::jsonb) as value", [
        JSON.stringify(input),
      ])
    ).rows[0].value;
  const consent = async (user, granted) =>
    as(
      user,
      "insert into nc_consents(owner_id,purpose,channel,granted) values($1,'matching','platform',$2)",
      [user, granted],
    );
  const save = (user, input) => rpc(user, "save_market_listing", input);
  const action = (user, id, act, extra = {}) =>
    rpc(user, "market_listing_action", { id, action: act, ...extra });
  const publish = async (l) => {
    await action(A, l.id, "submit");
    return action(B, l.id, "review", {
      decision: "PUBLISHED",
      note: "Independent review of fictitious content only",
      acknowledge: true,
    });
  };
  let j, y, v, ev, c, application, inquiry, order;
  try {
    await root("insert into auth.users values($1),($2),($3),($4),($5)", [
      A,
      B,
      C,
      D,
      E,
    ]);
    await root(
      "insert into nc_roles values($1,'RECRUITER'),($1,'SELLER'),($1,'ORGANIZER'),($2,'ADMIN'),($3,'AGENT')",
      [A, B, D],
    );
    await consent(A, true);
    await consent(C, true);
    await consent(D, true);
    await consent(E, true);
    await t.test(
      "direct table mutations and unapproved module roles are denied",
      async () => {
        await assert.rejects(save(C, job), /role required/);
        for (const table of [
          "nc_market_listings",
          "nc_market_reviews",
          "nc_talent_candidates",
          "nc_talent_optins",
          "nc_talent_applications",
          "nc_market_inquiries",
          "nc_event_orders",
          "nc_event_tickets",
          "nc_module_history",
        ])
          await assert.rejects(as(C, "delete from " + table));
        await assert.rejects(
          as(C, "update nc_market_listings set status='PUBLISHED'"),
        );
      },
    );
    await t.test(
      "listing review is independent, revision-bound, and rejects unknown facts",
      async () => {
        await assert.rejects(
          save(A, { ...job, facts: { ...job.facts, unknown: true } }),
        );
        j = await save(A, job);
        assert.equal(
          (await as(C, "select * from nc_market_listings where id=$1", [j.id]))
            .rows.length,
          0,
        );
        await action(A, j.id, "submit");
        await assert.rejects(
          action(A, j.id, "review", {
            decision: "PUBLISHED",
            note: "Self approval is forbidden",
            acknowledge: true,
          }),
        );
        j = await action(B, j.id, "review", {
          decision: "PUBLISHED",
          note: "Independent test publication review",
          acknowledge: true,
        });
        assert.equal(
          (await as(C, "select * from nc_market_listings where id=$1", [j.id]))
            .rows.length,
          1,
        );
        j = await save(A, {
          ...job,
          id: j.id,
          title: "Edited recruitment listing",
        });
        assert.equal(j.status, "DRAFT");
        assert.equal(j.revision, 2);
        j = await publish(j);
      },
    );
    await t.test(
      "self-service profiles require explicit consent and opt-out hides discovery",
      async () => {
        await consent(C, false);
        await assert.rejects(rpc(C, "save_talent_candidate", candidate));
        await consent(C, true);
        await assert.rejects(
          rpc(C, "save_talent_candidate", { ...candidate, attested: false }),
        );
        c = await rpc(C, "save_talent_candidate", candidate);
        assert.equal(
          (
            await as(A, "select * from nc_talent_candidates where id=$1", [
              c.id,
            ])
          ).rows.length,
          1,
        );
        await consent(C, false);
        assert.equal(
          (
            await as(A, "select * from nc_talent_candidates where id=$1", [
              c.id,
            ])
          ).rows.length,
          0,
        );
        await consent(C, true);
        await rpc(C, "save_talent_candidate", {
          ...candidate,
          discoverable: false,
        });
        assert.equal(
          (
            await as(A, "select * from nc_talent_candidates where id=$1", [
              c.id,
            ])
          ).rows.length,
          0,
        );
        c = await rpc(C, "save_talent_candidate", candidate);
        assert.equal(
          (await as(C, "select * from nc_talent_optins")).rows.length,
          3,
        );
      },
    );
    await t.test(
      "applications are private and shortlisting requires current consent/revision",
      async () => {
        application = await rpc(C, "apply_talent", {
          listing_id: j.id,
          message: "I consent to submit this fictitious tester application.",
        });
        assert.equal(application.profile_snapshot.name, candidate.name);
        await rpc(C, "save_talent_candidate", {
          ...candidate,
          name: "Updated public talent name",
        });
        assert.equal(
          (
            await as(
              A,
              "select profile_snapshot from nc_talent_applications where id=$1",
              [application.id],
            )
          ).rows[0].profile_snapshot.name,
          candidate.name,
        );
        await assert.rejects(
          as(
            C,
            "update nc_talent_applications set profile_snapshot='{}' where id=$1",
            [application.id],
          ),
        );
        assert.equal(
          (await as(E, "select * from nc_talent_applications")).rows.length,
          0,
        );
        await assert.rejects(
          rpc(E, "talent_application_action", {
            id: application.id,
            status: "SHORTLISTED",
          }),
        );
        await consent(C, false);
        await assert.rejects(
          rpc(A, "talent_application_action", {
            id: application.id,
            status: "SHORTLISTED",
          }),
        );
        await consent(C, true);
        assert.equal(
          (
            await rpc(A, "talent_application_action", {
              id: application.id,
              status: "SHORTLISTED",
            })
          ).status,
          "SHORTLISTED",
        );
        await rpc(C, "talent_application_action", {
          id: application.id,
          status: "WITHDRAWN",
        });
        await assert.rejects(
          rpc(A, "talent_application_action", {
            id: application.id,
            status: "SHORTLISTED",
          }),
        );
      },
    );
    await t.test(
      "yacht and aircraft require opted-in agent acceptance for each revision",
      async () => {
        await assert.rejects(
          save(A, {
            ...base,
            module: "YACHT",
            facts: { length_m: 42, year: 2019, guests: 12, offer: "CHARTER" },
          }),
        );
        await rpc(D, "save_market_agent", {
          display_name: "Fictitious Agent",
          business_name: "Test agency",
          active: true,
        });
        y = await save(A, {
          ...base,
          module: "YACHT",
          agent_id: D,
          facts: { length_m: 42, year: 2019, guests: 12, offer: "CHARTER" },
        });
        await assert.rejects(action(A, y.id, "submit"));
        await assert.rejects(action(E, y.id, "accept-agent"));
        await action(D, y.id, "accept-agent");
        y = await publish(y);
        y = await save(A, {
          ...base,
          id: y.id,
          module: "YACHT",
          agent_id: D,
          facts: { length_m: 43, year: 2019, guests: 12, offer: "CHARTER" },
        });
        await assert.rejects(action(A, y.id, "submit"));
        await action(D, y.id, "accept-agent");
        y = await publish(y);
        const aircraft = await save(A, {
          ...base,
          module: "AVIATION",
          agent_id: D,
          facts: {
            make: "Demo",
            model: "Test Jet",
            year: 2020,
            seats: 12,
            hours: 200,
            offer: "SALE",
          },
        });
        await assert.rejects(action(A, aircraft.id, "submit"));
      },
    );
    await t.test(
      "inquiries are private, explicit, current and cannot send externally",
      async () => {
        await assert.rejects(
          rpc(C, "market_inquiry", {
            listing_id: y.id,
            message: "Please share details about this demo yacht.",
            attested: false,
          }),
        );
        inquiry = await rpc(C, "market_inquiry", {
          listing_id: y.id,
          message: "Please share details about this demo yacht.",
          attested: true,
        });
        assert.equal(
          (await as(E, "select * from nc_market_inquiries")).rows.length,
          0,
        );
        assert.equal(
          (await as(D, "select * from nc_market_inquiries")).rows.length,
          1,
        );
        await rpc(D, "save_market_agent", {
          display_name: "Fictitious Agent",
          business_name: "Test agency",
          active: false,
        });
        assert.equal(
          (await as(E, "select * from nc_market_listings where id=$1", [y.id]))
            .rows.length,
          0,
        );
        assert.equal(
          (await as(D, "select * from nc_market_inquiries")).rows.length,
          0,
        );
        assert.equal(
          (await as(D, "select * from nc_market_listings where id=$1", [y.id]))
            .rows.length,
          0,
        );
        await assert.rejects(
          rpc(D, "market_inquiry_action", {
            id: inquiry.id,
            status: "ACCEPTED",
          }),
        );
        await rpc(D, "save_market_agent", {
          display_name: "Fictitious Agent",
          business_name: "Test agency",
          active: true,
        });
        await consent(C, false);
        await assert.rejects(
          rpc(A, "market_inquiry_action", {
            id: inquiry.id,
            status: "ACCEPTED",
          }),
        );
        await consent(C, true);
        assert.equal(
          (
            await rpc(D, "market_inquiry_action", {
              id: inquiry.id,
              status: "ACCEPTED",
            })
          ).status,
          "ACCEPTED",
        );
      },
    );
    await t.test(
      "vehicle dealer/broker roles and revoked owner roles are enforced",
      async () => {
        const vehicle = {
          ...base,
          module: "VEHICLE",
          facts: {
            make: "Demo",
            model: "EV",
            year: 2025,
            mileage_km: 100,
            fuel: "Electric",
            seller_type: "DEALER",
          },
        };
        await assert.rejects(
          save(A, {
            ...vehicle,
            facts: { ...vehicle.facts, seller_type: "BROKER" },
          }),
        );
        v = await publish(await save(A, vehicle));
        await root("delete from nc_roles where user_id=$1 and role='SELLER'", [
          A,
        ]);
        assert.equal(
          (await as(E, "select * from nc_market_listings where id=$1", [v.id]))
            .rows.length,
          0,
        );
        await root("insert into nc_roles values($1,'SELLER')", [A]);
      },
    );
    await t.test(
      "event registration is atomic, request-idempotent and capacity bounded",
      async () => {
        ev = await publish(await save(A, event));
        const request_key = randomUUID();
        const input = {
          listing_id: ev.id,
          request_key,
          quantity: 2,
          attested: true,
          demo_attestation: true,
        };
        await assert.rejects(
          rpc(C, "register_event", { ...input, demo_attestation: false }),
        );
        order = await rpc(C, "register_event", input);
        assert.equal(order.mode, "DEMO");
        assert.equal(Number(order.total_minor), 9000);
        assert.equal((await rpc(C, "register_event", input)).id, order.id);
        assert.equal(
          (await as(C, "select * from nc_event_tickets")).rows.length,
          2,
        );
        await assert.rejects(
          rpc(E, "register_event", {
            ...input,
            request_key: randomUUID(),
            quantity: 1,
          }),
          /capacity/,
        );
        await assert.rejects(
          save(A, {
            ...event,
            id: ev.id,
            title: "Changed event with active tickets",
          }),
        );
        await assert.rejects(as(C, "update nc_event_orders set total_minor=0"));
      },
    );
    await t.test(
      "ticket cancellation releases capacity; check-in is organizer-only and single-use",
      async () => {
        const ticket = (
          await as(C, "select * from nc_event_tickets where order_id=$1", [
            order.id,
          ])
        ).rows[0];
        await assert.rejects(
          rpc(E, "checkin_event_ticket", {
            listing_id: ev.id,
            reference: ticket.reference,
          }),
        );
        await assert.rejects(rpc(E, "cancel_event_order", { id: order.id }));
        await rpc(C, "cancel_event_order", { id: order.id });
        await assert.rejects(
          rpc(A, "checkin_event_ticket", {
            listing_id: ev.id,
            reference: ticket.reference,
          }),
        );
        const another = await rpc(E, "register_event", {
          listing_id: ev.id,
          request_key: randomUUID(),
          quantity: 1,
          attested: true,
          demo_attestation: true,
        });
        const valid = (
          await as(E, "select * from nc_event_tickets where order_id=$1", [
            another.id,
          ])
        ).rows[0];
        assert.equal(
          (
            await rpc(A, "checkin_event_ticket", {
              listing_id: ev.id,
              reference: valid.reference,
            })
          ).status,
          "CHECKED_IN",
        );
        await assert.rejects(
          rpc(A, "checkin_event_ticket", {
            listing_id: ev.id,
            reference: valid.reference,
          }),
        );
        await assert.rejects(rpc(E, "cancel_event_order", { id: another.id }));
      },
    );
    await t.test(
      "real paid checkout is blocked and free registration has no simulated payment",
      async () => {
        const paid = await publish(
          await save(A, {
            ...event,
            title: "Real-mode payment boundary test",
            is_demo: false,
          }),
        );
        await assert.rejects(
          rpc(C, "register_event", {
            listing_id: paid.id,
            request_key: randomUUID(),
            quantity: 1,
            attested: true,
            demo_attestation: true,
          }),
          /CHECKOUT_BLOCKED/,
        );
        const free = await publish(
          await save(A, {
            ...event,
            title: "Free registration boundary test",
            is_demo: false,
            price_minor: 0,
          }),
        );
        const r = await rpc(C, "register_event", {
          listing_id: free.id,
          request_key: randomUUID(),
          quantity: 1,
          attested: true,
          demo_attestation: false,
        });
        assert.equal(r.mode, "FREE");
        assert.equal(Number(r.total_minor), 0);
        assert.equal(
          (await as(E, "select * from nc_event_orders where id=$1", [r.id]))
            .rows.length,
          0,
        );
        const futureTicket = (
          await as(C, "select * from nc_event_tickets where order_id=$1", [
            r.id,
          ])
        ).rows[0];
        await assert.rejects(
          rpc(A, "checkin_event_ticket", {
            listing_id: free.id,
            reference: futureTicket.reference,
          }),
          /two hours/,
        );
        await rpc(C, "cancel_event_order", { id: r.id });
        const revised = await save(A, {
          ...event,
          id: free.id,
          title: "Private revised event draft",
          is_demo: false,
          price_minor: 0,
        });
        assert.equal(
          (
            await as(C, "select * from nc_market_listings where id=$1", [
              revised.id,
            ])
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await as(
              C,
              "select event_snapshot from nc_event_orders where id=$1",
              [r.id],
            )
          ).rows[0].event_snapshot.title,
          "Free registration boundary test",
        );
      },
    );
    await t.test(
      "history is immutable and anonymous callers cannot access records or RPCs",
      async () => {
        assert.ok(
          (await as(C, "select * from nc_module_history")).rows.length > 0,
        );
        await assert.rejects(
          as(C, "update nc_module_history set action=$1", ["FORGED"]),
        );
        await db.exec("reset role;set role anon");
        await assert.rejects(db.query("select * from nc_market_listings"));
        await assert.rejects(
          db.query("select nc_register_event($1::jsonb)", ["{}"]),
        );
      },
    );
  } finally {
    await db.close();
  }
});
