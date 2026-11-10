import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { database } from "./fixtures/database.mjs";
import { parsePropertyCsv } from "../src/features/real-estate/csv.mjs";
import { validateEvidence } from "../src/features/real-estate/evidence.mjs";
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002",
  C = "10000000-0000-4000-8000-000000000003";
test("CSV is bounded and preserves quoted fields; evidence requires matching signatures", async () => {
  const rows = parsePropertyCsv(
    await fs.readFile(
      new URL("../public/examples/vacant-lots-demo.csv", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(rows.length, 40);
  assert.throws(() => parsePropertyCsv("address,address\nx,x"));
  assert.throws(() => parsePropertyCsv("x".repeat(256001)));
  assert.throws(() =>
    validateEvidence(new Uint8Array([1, 2, 3]), "image/jpeg"),
  );
  assert.throws(() =>
    validateEvidence(new Uint8Array(2097153), "application/pdf"),
  );
  assert.equal(
    validateEvidence(
      new TextEncoder().encode("%PDF-1.7 demo"),
      "application/pdf",
    ).byteSize,
    13,
  );
});
test("Phase 2 SQL ownership, imports, independent reviews and delivery snapshots", async (t) => {
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
      await as(user, "select nc_" + name + "($1::jsonb) as result", [
        JSON.stringify(input),
      ])
    ).rows[0].result;
  try {
    await root("insert into auth.users values($1),($2),($3)", [A, B, C]);
    await root("insert into nc_roles values($1,'ADMIN'),($2,'ADMIN')", [A, B]);
    await as(
      A,
      "insert into nc_consents(owner_id,purpose,channel,granted) values($1,'matching','platform',true)",
      [A],
    );
    const records = parsePropertyCsv(
      await fs.readFile(
        new URL("../public/examples/vacant-lots-demo.csv", import.meta.url),
        "utf8",
      ),
    ).map((r) => ({
      ...r,
      lot_acres: Number(r.lot_acres),
      asking_price: Number(r.asking_price),
    }));
    const meta = {
      request_key: randomUUID(),
      source: "Fictitious demo CSV",
      license_evidence: "Fictitious data supplied for demo testing only",
      is_demo: true,
      attested: true,
    };
    const importRows = (rows, m = meta) =>
      as(A, "select nc_import_properties($1::jsonb,$2::jsonb) as result", [
        JSON.stringify(m),
        JSON.stringify(rows),
      ]).then((r) => r.rows[0].result);
    let p, form, partner, evidence, claim;
    await t.test(
      "transactional 40-record import, idempotency and owner isolation",
      async () => {
        const run = await importRows(records);
        assert.equal(run.inserted_count, 40);
        assert.equal((await importRows(records)).id, run.id);
        const again = await importRows(records, {
          ...meta,
          request_key: randomUUID(),
        });
        assert.equal(again.unchanged_count, 40);
        assert.equal(
          (await as(C, "select * from nc_properties")).rows.length,
          0,
        );
        assert.equal(
          (await as(A, "select * from nc_properties")).rows.length,
          40,
        );
        p = (
          await as(A, "select * from nc_properties order by address limit 1")
        ).rows[0];
        const bad = await importRows(
          [
            { ...records[0], address: "New Valid Property" },
            { ...records[1], lot_acres: -1 },
          ],
          { ...meta, request_key: randomUUID() },
        );
        assert.equal(bad.status, "FAILED");
        assert.equal(
          (await as(A, "select * from nc_properties")).rows.length,
          40,
        );
      },
    );
    await t.test(
      "direct grants cannot forge claims, evidence, imports or deliveries",
      async () => {
        for (const table of [
          "nc_property_claims",
          "nc_property_evidence",
          "nc_property_imports",
          "nc_partner_forms",
          "nc_form_deliveries",
          "nc_form_reviews",
          "nc_property_permissions",
          "nc_property_outreach",
        ])
          await assert.rejects(as(A, "delete from " + table));
        await assert.rejects(
          as(
            A,
            "update nc_property_claims set status='VERIFIED' where property_id=$1",
            [p.id],
          ),
        );
        await assert.rejects(
          rpc(C, "demo_property_evidence", {
            property_id: p.id,
            label: "Forged evidence",
            content_note: "Unowned property",
          }),
        );
      },
    );
    await t.test(
      "claims require evidence and independent review; unchanged imports preserve review",
      async () => {
        evidence = await rpc(A, "demo_property_evidence", {
          property_id: p.id,
          label: "Demo source document",
          content_note: "Fictitious evidence; no real property verification",
        });
        claim = await rpc(A, "request_claim_review", {
          property_id: p.id,
          claim_key: "lot_acres",
          evidence_id: evidence.id,
        });
        await assert.rejects(
          rpc(A, "review_property_claim", {
            id: claim.id,
            decision: "VERIFIED",
            note: "Self approval forbidden",
          }),
        );
        await assert.rejects(
          rpc(C, "review_property_claim", {
            id: claim.id,
            decision: "VERIFIED",
            note: "Non admin forbidden",
          }),
        );
        await rpc(B, "review_property_claim", {
          id: claim.id,
          decision: "VERIFIED",
          note: "Reviewed fictitious demo evidence",
        });
        await importRows(records, { ...meta, request_key: randomUUID() });
        assert.equal(
          (
            await as(A, "select status from nc_property_claims where id=$1", [
              claim.id,
            ])
          ).rows[0].status,
          "VERIFIED",
        );
      },
    );
    await t.test(
      "template mappings reject null/unknown values at database boundary",
      async () => {
        await as(A, "select nc_demo_developers()");
        partner = (
          await as(A, "select * from nc_developers where region=$1", [p.region])
        ).rows[0];
        assert.ok(partner);
        for (const mapping of [
          { field: null },
          { field: "password" },
          { field: { nested: "address" } },
        ])
          await assert.rejects(
            as(
              A,
              "insert into nc_partner_templates(owner_id,partner_id,template_key,version,title,field_mapping,approved,is_demo,created_by) values($1,$2,$3,1,$4,$5,true,true,$1)",
              [
                A,
                partner.id,
                "invalid-" + randomUUID(),
                "Invalid mapping",
                JSON.stringify(mapping),
              ],
            ),
          );
      },
    );
    const create = () =>
      rpc(A, "create_partner_form", {
        property_id: p.id,
        partner_id: partner.id,
        template_id: "f0000000-0000-4000-8000-000000000001",
      });
    const review = () =>
      rpc(B, "review_partner_form", {
        id: form.id,
        decision: "APPROVED",
        note: "Reviewed demo form and all verification disclosures",
        acknowledge_unverified: true,
      });
    await t.test(
      "form approval cannot be bypassed and edits invalidate approved versions",
      async () => {
        form = await create();
        await assert.rejects(
          rpc(A, "simulate_partner_delivery", {
            id: form.id,
            demo_attestation: true,
          }),
        );
        await rpc(A, "submit_partner_form", { id: form.id });
        await assert.rejects(
          rpc(A, "review_partner_form", {
            id: form.id,
            decision: "APPROVED",
            note: "Owner cannot review",
            acknowledge_unverified: true,
          }),
        );
        await review();
        form = await rpc(A, "edit_partner_form", {
          id: form.id,
          regenerate: false,
          fields: { site_address: "Edited demo address" },
        });
        assert.equal(form.status, "DRAFT");
        await assert.rejects(
          rpc(A, "simulate_partner_delivery", {
            id: form.id,
            demo_attestation: true,
          }),
        );
        await assert.rejects(
          rpc(A, "edit_partner_form", {
            id: form.id,
            regenerate: false,
            fields: { _demo: false },
          }),
        );
        await rpc(A, "submit_partner_form", { id: form.id });
        await review();
      },
    );
    await t.test(
      "changed property facts reset claims and stale form approvals",
      async () => {
        await as(
          A,
          "update nc_properties set lot_acres=lot_acres+0.001 where id=$1",
          [p.id],
        );
        assert.equal(
          (
            await as(A, "select status from nc_property_claims where id=$1", [
              claim.id,
            ])
          ).rows[0].status,
          "UNVERIFIED",
        );
        await assert.rejects(
          rpc(A, "simulate_partner_delivery", {
            id: form.id,
            demo_attestation: true,
          }),
        );
        await assert.rejects(rpc(A, "submit_partner_form", { id: form.id }));
        form = await rpc(A, "edit_partner_form", {
          id: form.id,
          regenerate: true,
        });
        await rpc(A, "submit_partner_form", { id: form.id });
        await review();
      },
    );
    await t.test(
      "partner edits and consent withdrawal block delivery until new review and consent",
      async () => {
        await as(
          A,
          "update nc_developers set max_price=max_price+1 where id=$1",
          [partner.id],
        );
        await assert.rejects(
          rpc(A, "simulate_partner_delivery", {
            id: form.id,
            demo_attestation: true,
          }),
        );
        form = await rpc(A, "edit_partner_form", {
          id: form.id,
          regenerate: true,
        });
        await rpc(A, "submit_partner_form", { id: form.id });
        await review();
        await as(
          A,
          "insert into nc_consents(owner_id,purpose,channel,granted) values($1,'matching','platform',false)",
          [A],
        );
        await assert.rejects(
          rpc(A, "simulate_partner_delivery", {
            id: form.id,
            demo_attestation: true,
          }),
        );
        await as(
          A,
          "insert into nc_consents(owner_id,purpose,channel,granted) values($1,'matching','platform',true)",
          [A],
        );
      },
    );
    await t.test(
      "simulation creates one immutable receipt and never claims live delivery",
      async () => {
        const receipt = await rpc(A, "simulate_partner_delivery", {
          id: form.id,
          demo_attestation: true,
        });
        assert.equal(receipt.mode, "DEMO");
        assert.equal(receipt.status, "SIMULATED_SENT");
        assert.equal(
          (
            await rpc(A, "simulate_partner_delivery", {
              id: form.id,
              demo_attestation: true,
            })
          ).id,
          receipt.id,
        );
        await assert.rejects(
          rpc(A, "edit_partner_form", { id: form.id, regenerate: true }),
        );
        await assert.rejects(
          as(A, "update nc_form_deliveries set status='SIMULATED_SENT'"),
        );
      },
    );
    await t.test(
      "real records cannot use demo evidence or live delivery even after independent approval",
      async () => {
        const real = (
          await as(
            A,
            "insert into nc_properties(owner_id,address,region,lot_acres,asking_price,source,license_evidence,is_demo) values($1,'Authorized test property','Texas',5,100000,'Supplied test source','Operator supplied test authorization',false) returning id",
            [A],
          )
        ).rows[0];
        await assert.rejects(
          rpc(A, "demo_property_evidence", {
            property_id: real.id,
            label: "Invalid demo evidence",
            content_note: "Demo cannot verify real property",
          }),
        );
        await assert.rejects(
          rpc(A, "request_claim_review", {
            property_id: real.id,
            claim_key: "ownership",
            evidence_id: evidence.id,
          }),
        );
        const dev = (
          await as(
            A,
            "insert into nc_developers(owner_id,name,region,min_acres,max_acres,max_price,email,email_opt_in,permission_evidence,is_demo) values($1,'Supplied test partner','Texas',1,10,200000,'partner@example.test',true,'Supplied test email authorization',false) returning id",
            [A],
          )
        ).rows[0];
        const template = (
          await as(
            A,
            "insert into nc_partner_templates(owner_id,partner_id,template_key,version,title,field_mapping,approved,is_demo,created_by) values($1,$2,'real-test',1,'Supplied partner test template','{\"site\":\"address\"}',true,false,$1) returning id",
            [A, dev.id],
          )
        ).rows[0];
        const draft = await rpc(A, "create_partner_form", {
          property_id: real.id,
          partner_id: dev.id,
          template_id: template.id,
        });
        await rpc(A, "submit_partner_form", { id: draft.id });
        await rpc(B, "review_partner_form", {
          id: draft.id,
          decision: "APPROVED",
          note: "Independent test of live delivery guard",
          acknowledge_unverified: true,
        });
        await assert.rejects(
          rpc(A, "simulate_partner_delivery", {
            id: draft.id,
            demo_attestation: true,
          }),
          /Live delivery blocked/,
        );
        assert.equal(
          (await as(C, "select * from nc_partner_forms")).rows.length,
          0,
        );
        await assert.rejects(
          rpc(C, "edit_partner_form", { id: draft.id, regenerate: true }),
        );
        await assert.rejects(as(A, "delete from nc_form_reviews"));
      },
    );
    await t.test(
      "contact permissions are immutable, latest wins, contact edits invalidate grants",
      async () => {
        const contact = await rpc(A, "save_property_contact", {
          property_id: p.id,
          name: "Demo Contact",
          email: "demo@example.test",
          phone: "",
          source: "Fictitious contact supplied for demonstration",
        });
        const log = {
          contact_id: contact.id,
          channel: "EMAIL",
          notes: "Manually recorded fictitious outreach",
          manual_attestation: true,
        };
        await assert.rejects(rpc(A, "log_property_outreach", log));
        await rpc(A, "record_property_permission", {
          contact_id: contact.id,
          channel: "EMAIL",
          granted: true,
          evidence: "Fictitious demo email permission",
        });
        assert.equal(
          (await rpc(A, "log_property_outreach", log)).mode,
          "DEMO_LOG",
        );
        await rpc(A, "record_property_permission", {
          contact_id: contact.id,
          channel: "EMAIL",
          granted: false,
          evidence: "Demo permission withdrawn",
        });
        await assert.rejects(rpc(A, "log_property_outreach", log));
        await rpc(A, "record_property_permission", {
          contact_id: contact.id,
          channel: "EMAIL",
          granted: true,
          evidence: "Demo permission restored",
        });
        await rpc(A, "save_property_contact", {
          property_id: p.id,
          name: "Demo Contact",
          email: "changed@example.test",
          phone: "",
          source: "Fictitious contact supplied for demonstration",
        });
        await assert.rejects(rpc(A, "log_property_outreach", log));
      },
    );
    await t.test(
      "private Storage objects require owned registration and matching metadata",
      async () => {
        const doc = await rpc(A, "register_property_evidence", {
          id: randomUUID(),
          property_id: p.id,
          label: "Private PDF",
          mime_type: "application/pdf",
          byte_size: 13,
          sha256: "a".repeat(64),
        });
        await assert.rejects(
          rpc(A, "complete_property_evidence", { id: doc.id }),
        );
        await assert.rejects(
          as(
            C,
            "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
            [
              "netcozy-property-evidence",
              doc.object_key,
              JSON.stringify({ mimetype: "application/pdf", size: 13 }),
            ],
          ),
        );
        await as(
          A,
          "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
          [
            "netcozy-property-evidence",
            doc.object_key,
            JSON.stringify({ mimetype: "application/pdf", size: 13 }),
          ],
        );
        assert.equal(
          (await rpc(A, "complete_property_evidence", { id: doc.id })).status,
          "UPLOADED_UNSCANNED",
        );
        assert.equal(
          (await as(C, "select * from storage.objects")).rows.length,
          0,
        );
        await assert.rejects(as(A, "delete from storage.objects"));
      },
    );
  } finally {
    await db.close();
  }
});
