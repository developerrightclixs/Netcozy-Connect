import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
let db;
async function as(user, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  return db.query(sql, params);
}
async function root(sql, params = []) {
  await db.exec("reset role");
  return db.query(sql, params);
}
test("Supabase migrations, ownership, consent, role boundaries and review gates on PostgreSQL", async (t) => {
  db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    for (const file of [
      "202611100001_shared_core.sql",
      "202611100002_demo_directory.sql",
    ])
      await db.exec(
        (
          await fs.readFile(
            new URL("../supabase/migrations/" + file, import.meta.url),
            "utf8",
          )
        ).replace(/^\uFEFF/, ""),
      );
    await root("insert into auth.users(id) values ($1),($2)", [A, B]);
    await t.test(
      "member sees only own profile; cannot read or update another user",
      async () => {
        assert.equal((await as(A, "select * from nc_profiles")).rows.length, 1);
        assert.equal(
          (await as(A, "select * from nc_profiles where id=$1", [B])).rows
            .length,
          0,
        );
        assert.equal(
          (
            await as(
              A,
              "update nc_profiles set display_name='Intruder' where id=$1 returning id",
              [B],
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "member cannot forge roles, verification or audit events",
      async () => {
        await assert.rejects(
          as(A, "insert into nc_roles values($1,'ADMIN')", [A]),
        );
        await assert.rejects(
          as(
            A,
            "insert into nc_identity_checks(owner_id,provider,status,reference) values($1,'DEMO','DEMO_PASSED','forged')",
            [A],
          ),
        );
        await assert.rejects(
          as(
            A,
            "insert into nc_audit(actor_id,action,entity,entity_id) values($1,'forged','x','x')",
            [A],
          ),
        );
        await assert.rejects(
          as(A, "select nc_assign_role($1,'ADMIN',false)", [A]),
        );
      },
    );
    await t.test("directory is hidden without matching consent", async () =>
      assert.equal((await as(A, "select * from nc_directory")).rows.length, 0),
    );
    await t.test(
      "consent evidence cannot have forged timestamps or policy metadata",
      async () => {
        await assert.rejects(
          as(
            A,
            "insert into nc_consents(owner_id,purpose,channel,granted,created_at) values($1,'matching','platform',true,'2099-01-01')",
            [A],
          ),
        );
      },
    );
    await as(
      A,
      "insert into nc_consents(owner_id,purpose,channel,granted) values($1,'matching','platform',true)",
      [A],
    );
    await t.test(
      "consent reveals only demo opted-in directory; history immutable",
      async () => {
        assert.equal(
          (await as(A, "select * from nc_directory")).rows.length,
          12,
        );
        await assert.rejects(as(A, "delete from nc_consents"));
        await assert.rejects(as(A, "update nc_consents set granted=false"));
      },
    );
    const goal = (
      await as(
        A,
        "insert into nc_goals(owner_id,industry,intent,target_intent,title) values($1,'talent','hire','work','Find testers') returning id",
        [A],
      )
    ).rows[0].id;
    const template = (await as(A, "select id from nc_templates")).rows[0].id;
    const person = "d0000000-0000-4000-8000-000000000001";
    await t.test(
      "cross-owner goal references cannot enter feedback or drafts",
      async () => {
        await assert.rejects(
          as(
            B,
            "insert into nc_match_feedback(owner_id,goal_id,directory_id,status) values($1,$2,$3,'SAVED')",
            [B, goal, person],
          ),
        );
      },
    );
    const draft = (
      await as(
        A,
        "insert into nc_drafts(owner_id,goal_id,directory_id,template_id,body,reviewed_at) values($1,$2,$3,$4,'A valid outreach draft.',now()) returning id,reviewed_at",
        [A, goal, person, template],
      )
    ).rows[0];
    await t.test("new draft cannot bypass human review", async () =>
      assert.equal(draft.reviewed_at, null),
    );
    const lead = (
      await as(
        A,
        "insert into nc_leads(owner_id,goal_id,directory_id,draft_id,pipeline) values($1,$2,$3,$4,'RECRUITMENT') returning id",
        [A, goal, person, draft.id],
      )
    ).rows[0].id;
    await t.test(
      "database prevents sent stage before human review",
      async () =>
        await assert.rejects(
          as(A, "update nc_leads set stage='SENT' where id=$1", [lead]),
        ),
    );
    await as(A, "update nc_drafts set reviewed_at=now() where id=$1", [
      draft.id,
    ]);
    await as(A, "update nc_leads set stage='SENT' where id=$1", [lead]);
    await t.test("editing reviewed body invalidates approval", async () => {
      const result = await as(
        A,
        "update nc_drafts set body='Changed outreach text.' where id=$1 returning reviewed_at",
        [draft.id],
      );
      assert.equal(result.rows[0].reviewed_at, null);
      await assert.rejects(
        as(A, "update nc_leads set stage='REPLIED' where id=$1", [lead]),
      );
    });
    await t.test(
      "revocation immediately removes directory and prevents review/progression",
      async () => {
        await as(
          A,
          "insert into nc_consents(owner_id,purpose,channel,granted) values($1,'matching','platform',false)",
          [A],
        );
        assert.equal(
          (await as(A, "select * from nc_directory")).rows.length,
          0,
        );
        await assert.rejects(
          as(A, "update nc_drafts set reviewed_at=now() where id=$1", [
            draft.id,
          ]),
        );
        await assert.rejects(
          as(A, "update nc_leads set stage='SENT' where id=$1", [lead]),
        );
      },
    );
    await t.test(
      "onboarding rolls back without a demo identity result",
      async () => {
        const input = {
          goal_id: "20000000-0000-4000-8000-000000000001",
          display_name: "B Example",
          headline: "Test",
          region: "Texas",
          skills: ["testing"],
          linkedin_url: "",
          industry: "talent",
          intent: "hire",
          target_intent: "work",
          title: "Find QA testers",
          matching_consent: true,
        };
        await assert.rejects(
          as(B, "select nc_complete_onboarding($1::jsonb)", [
            JSON.stringify(input),
          ]),
        );
        await as(B, "select nc_demo_identity()");
        await as(B, "select nc_complete_onboarding($1::jsonb)", [
          JSON.stringify(input),
        ]);
        assert.equal(
          (await as(B, "select onboarding_complete from nc_profiles")).rows[0]
            .onboarding_complete,
          true,
        );
        assert.equal(
          (await as(B, "select provider,status from nc_identity_checks"))
            .rows[0].status,
          "DEMO_PASSED",
        );
      },
    );
    await t.test(
      "audit includes actor/action/entity/time and cannot be changed",
      async () => {
        const audit = (await as(A, "select * from nc_audit")).rows;
        assert.ok(audit.length > 0);
        assert.ok(
          audit.every(
            (e) => e.actor_id === A && e.action && e.entity && e.created_at,
          ),
        );
        await assert.rejects(as(A, "update nc_audit set action='fake'"));
      },
    );
    await t.test(
      "anonymous users cannot read application tables or call onboarding",
      async () => {
        await db.exec("reset role; set role anon");
        await assert.rejects(db.query("select * from nc_profiles"));
        await assert.rejects(db.query("select nc_demo_identity()"));
      },
    );
    await t.test(
      "admin membership is server controlled and cannot grant super-admin",
      async () => {
        await root(
          "insert into nc_roles(user_id,role) values($1,'SUPER_ADMIN')",
          [A],
        );
        await as(A, "select nc_assign_role($1,'ADMIN',false)", [B]);
        assert.equal((await as(B, "select * from nc_profiles")).rows.length, 2);
        await assert.rejects(
          as(B, "select nc_assign_role($1,'ADMIN',false)", [A]),
        );
        await assert.rejects(
          as(A, "select nc_assign_role($1,'SUPER_ADMIN',false)", [B]),
        );
      },
    );
  } finally {
    await db.close();
  }
});
