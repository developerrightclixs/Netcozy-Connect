import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database } from "./fixtures/database.mjs";
import {
  brandSchema,
  creativeSchema,
  metricsSchema,
} from "../src/features/studio/domain.ts";
const A = "41000000-0000-4000-8000-000000000001",
  B = "41000000-0000-4000-8000-000000000002",
  C = "41000000-0000-4000-8000-000000000003";
const brand = {
  name: "Demo Business",
  website: "https://example.com",
  industry: "Hospitality",
  audience: "Regional business owners",
  offer: "Employee rewards and experiences",
  voice: "Warm and clear",
  color: "#0f766e",
  acknowledge: true,
};
const creative = {
  title: "A new rewards story",
  kind: "IMAGE",
  channel: "LINKEDIN",
  scheduled_at: "2027-01-12T12:00:00Z",
  caption: "Explore employee rewards with our team.",
  script: "Opening title followed by benefits and a call to action.",
  audience: brand.audience,
};
test("Studio validation rejects unsafe URLs, excess fields, missing review and negative counts", () => {
  assert.ok(brandSchema.safeParse(brand).success);
  assert.equal(
    brandSchema.safeParse({ ...brand, website: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    brandSchema.safeParse({ ...brand, acknowledge: false }).success,
    false,
  );
  assert.equal(
    creativeSchema.safeParse({ ...creative, status: "APPROVED" }).success,
    false,
  );
  assert.equal(
    creativeSchema.safeParse({ ...creative, id: randomUUID() }).success,
    false,
  );
  assert.equal(
    metricsSchema.safeParse({
      id: randomUUID(),
      revision: 1,
      request_key: randomUUID(),
      period_start: "2026-01-02",
      period_end: "2026-01-01",
      views: -1,
      clicks: 0,
      replies: 0,
      conversions: 0,
      evidence: "Manual test report",
      acknowledge: true,
    }).success,
    false,
  );
});
test("Studio SQL/RLS: private drafts, revision-bound independent review, immutable export/usage and manual reports", async (t) => {
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
  const rpc = async (user, action, data) =>
    (
      await as(user, "select nc_studio_mutate($1::jsonb) as value", [
        JSON.stringify({ action, data }),
      ])
    ).rows[0].value;
  let c, exp;
  const version = () => ({ id: c.id, revision: c.revision });
  const review = () => ({
    ...version(),
    decision: "APPROVED",
    note: "Reviewed supplied claims and intended channel",
    acknowledge: true,
  });
  try {
    await root("insert into auth.users values($1),($2),($3)", [A, B, C]);
    await root("insert into nc_roles values($1,'ADMIN'),($2,'ADMIN')", [A, B]);
    await t.test(
      "business and draft writes reject bypasses and remain private",
      async () => {
        await assert.rejects(
          rpc(A, "demo-prepare", creative),
          /profile required/,
        );
        await rpc(A, "brand-save", brand);
        c = await rpc(A, "creative-save", creative);
        for (const table of [
          "brands",
          "creatives",
          "reviews",
          "exports",
          "usage",
          "metrics",
        ]) {
          await assert.rejects(
            as(A, "delete from nc_studio_" + table),
            /permission denied/,
          );
          await assert.rejects(
            as(A, "update nc_studio_" + table + " set owner_id=$1", [C]),
            /permission denied/,
          );
          assert.equal(
            (await as(C, "select * from nc_studio_" + table)).rows.length,
            0,
          );
        }
        await assert.rejects(
          rpc(C, "creative-save", { ...creative, ...version() }),
          /profile required/,
        );
        await rpc(C, "brand-save", { ...brand, name: "Another business" });
        await assert.rejects(
          rpc(C, "creative-save", { ...creative, ...version() }),
          /Owned current/,
        );
        await assert.rejects(rpc(C, "export", version()), /ownership/);
        await assert.rejects(rpc(A, "publish", version()), /unavailable/);
        await assert.rejects(rpc(A, "export", version()), /approval required/);
      },
    );
    await t.test(
      "demo text creates zero-charge usage, never fake provider calls",
      async () => {
        const d = await rpc(A, "demo-prepare", creative);
        assert.equal(d.source, "DEMO_TEMPLATE");
        assert.match(d.script, /No image or video/);
        const usage = (await as(A, "select * from nc_studio_usage")).rows;
        assert.equal(usage.length, 1);
        assert.equal(usage[0].provider_calls, 0);
      },
    );
    await t.test(
      "only an independent current admin can approve and exports are idempotent",
      async () => {
        await rpc(A, "submit", version());
        await assert.rejects(rpc(A, "review", review()), /Independent/);
        await assert.rejects(rpc(C, "review", review()), /Independent/);
        await assert.rejects(
          rpc(B, "review", { ...review(), revision: 99 }),
          /Current creative/,
        );
        await rpc(B, "review", review());
        exp = await rpc(A, "export", version());
        assert.equal(exp.snapshot.delivery, "MANUAL_EXPORT_ONLY");
        assert.equal((await rpc(A, "export", version())).id, exp.id);
        assert.equal(
          (await as(C, "select * from nc_studio_exports")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "edits invalidate approval and stale reviewers/exporters are rejected",
      async () => {
        const old = version();
        c = await rpc(A, "creative-save", {
          ...creative,
          ...old,
          caption: "A revised, human-written caption.",
        });
        assert.equal(c.status, "DRAFT");
        assert.equal(c.approved_revision, null);
        await assert.rejects(
          rpc(A, "creative-save", { ...creative, ...old }),
          /current revision/,
        );
        await assert.rejects(rpc(A, "export", version()), /approval required/);
        await assert.rejects(
          rpc(B, "review", { ...review(), ...old }),
          /Current creative/,
        );
        assert.equal(
          (await as(A, "select * from nc_studio_exports")).rows[0].snapshot
            .creative.caption,
          creative.caption,
        );
        await rpc(A, "submit", version());
        await rpc(B, "review", { ...review(), decision: "REJECTED" });
        await assert.rejects(rpc(A, "submit", version()), /Revise rejected/);
        c = await rpc(A, "creative-save", { ...creative, ...version() });
        await rpc(A, "submit", version());
        await rpc(B, "review", review());
      },
    );
    await t.test(
      "brand changes invalidate pending and approved creatives",
      async () => {
        await rpc(A, "brand-save", {
          ...brand,
          offer: "Revised employee rewards programme",
        });
        c = (
          await as(A, "select * from nc_studio_creatives where id=$1", [c.id])
        ).rows[0];
        assert.equal(c.status, "DRAFT");
        await assert.rejects(rpc(A, "submit", version()), /current draft/);
        await assert.rejects(rpc(A, "export", version()), /approval required/);
        c = await rpc(A, "creative-save", { ...creative, ...version() });
        await rpc(A, "submit", version());
        await rpc(B, "review", review());
        await rpc(A, "export", version());
      },
    );
    await t.test(
      "manual aggregate snapshots are immutable, bounded and replay-safe",
      async () => {
        const data = {
          ...version(),
          request_key: randomUUID(),
          period_start: "2026-01-01",
          period_end: "2026-01-02",
          views: 100,
          clicks: 5,
          replies: 2,
          conversions: 1,
          evidence: "Owner-supplied aggregate platform report",
          acknowledge: true,
        };
        const m = await rpc(A, "metrics", data);
        assert.equal(m.source, "MANUAL_UNVERIFIED");
        assert.equal((await rpc(A, "metrics", data)).id, m.id);
        await assert.rejects(rpc(C, "metrics", data), /ownership/);
        await assert.rejects(
          rpc(A, "metrics", {
            ...data,
            request_key: randomUUID(),
            period_start: "2026-01-03",
            period_end: "2026-01-04",
            views: -1,
          }),
          /check constraint/,
        );
        await assert.rejects(
          rpc(A, "metrics", {
            ...data,
            request_key: randomUUID(),
            period_end: "2099-01-01",
          }),
          /future/,
        );
        await assert.rejects(
          rpc(A, "metrics", { ...data, request_key: randomUUID() }),
          /unique constraint/,
        );
      },
    );
    await t.test(
      "private media registration, storage isolation and attachment invalidate approval",
      async () => {
        const assetRpc = async (user, input) =>
          (
            await as(user, "select nc_studio_asset($1::jsonb) as value", [
              JSON.stringify(input),
            ])
          ).rows[0].value;
        const input = {
          action: "register",
          id: randomUUID(),
          label: "Authorized image",
          mime_type: "image/png",
          byte_size: 8,
          sha256: "a".repeat(64),
          rights_note: "Owned fictitious test image",
          acknowledge: true,
        };
        await assert.rejects(
          assetRpc(A, { ...input, acknowledge: false }),
          /rights/,
        );
        const a = await assetRpc(A, input);
        await assert.rejects(
          assetRpc(C, { action: "complete", id: a.id }),
          /Pending owned/,
        );
        await assert.rejects(
          assetRpc(A, { action: "complete", id: a.id }),
          /Matching private/,
        );
        await assert.rejects(
          as(
            C,
            "insert into storage.objects(bucket_id,name,metadata) values('netcozy-studio-assets',$1,$2)",
            [a.object_key, JSON.stringify({ mimetype: "image/png", size: 8 })],
          ),
          /row-level security/,
        );
        await as(
          A,
          "insert into storage.objects(bucket_id,name,metadata) values('netcozy-studio-assets',$1,$2)",
          [a.object_key, JSON.stringify({ mimetype: "image/png", size: 8 })],
        );
        assert.equal(
          (
            await as(
              C,
              "select * from storage.objects where bucket_id='netcozy-studio-assets'",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (await as(C, "select * from nc_studio_assets")).rows.length,
          0,
        );
        await assetRpc(A, { action: "complete", id: a.id });
        await assert.rejects(
          as(A, "update nc_studio_assets set label='Changed'"),
          /permission denied/,
        );
        await assert.rejects(
          assetRpc(C, {
            action: "attach",
            id: a.id,
            creative_id: c.id,
            revision: c.revision,
          }),
          /Owned creative/,
        );
        c = await assetRpc(A, {
          action: "attach",
          id: a.id,
          creative_id: c.id,
          revision: c.revision,
        });
        assert.equal(c.asset_id, a.id);
        assert.equal(c.status, "DRAFT");
        assert.equal(c.approved_revision, null);
        await assert.rejects(rpc(A, "export", version()), /approval required/);
        await rpc(A, "submit", version());
        await rpc(B, "review", review());
        const snapshot = await rpc(A, "export", version());
        assert.equal(snapshot.snapshot.creative.asset_id, a.id);
        await assert.rejects(
          assetRpc(A, { ...input, id: randomUUID(), mime_type: "video/mp4" }),
          /check constraint/,
        );
      },
    );
    await t.test(
      "revoked reviewer role and anonymous access fail closed",
      async () => {
        c = await rpc(A, "creative-save", { ...creative, ...version() });
        await rpc(A, "submit", version());
        await root("delete from nc_roles where user_id=$1 and role='ADMIN'", [
          B,
        ]);
        await assert.rejects(rpc(B, "review", review()), /Independent/);
        await db.exec("reset role;set role anon");
        await assert.rejects(
          db.query("select nc_studio_mutate('{}'::jsonb)"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select * from nc_studio_creatives"),
          /permission denied/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
