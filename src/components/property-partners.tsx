"use client";
import { useState } from "react";
import type { Developer, PartnerForm } from "@/features/real-estate/domain";
import { templateSources } from "@/features/real-estate/domain";
import type { PropertyData, PropertyRun } from "./property-workspace";
import { field, Select } from "./ui";
function DeveloperEditor({
  developer: d,
  run,
}: {
  developer?: Developer;
  run: PropertyRun;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const value = {
          name: field(f, "name"),
          region: field(f, "region"),
          min_acres: Number(field(f, "min_acres")),
          max_acres: Number(field(f, "max_acres")),
          max_price: Number(field(f, "max_price")),
          zoning: field(f, "zoning")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          preferences: field(f, "preferences"),
          email: field(f, "email"),
          email_opt_in: f.has("email_opt_in"),
          permission_evidence: field(f, "permission_evidence"),
          is_demo: d?.is_demo ?? f.has("is_demo"),
          active: f.has("active"),
        };
        void run(
          d ? "developer-edit" : "developer",
          d ? { id: d.id, value } : value,
        );
      }}
    >
      <div className="form-grid">
        <label>
          Developer name
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={d?.name}
          />
        </label>
        <label>
          Developer region
          <input
            name="region"
            required
            minLength={2}
            maxLength={100}
            defaultValue={d?.region}
          />
        </label>
        {[
          ["min_acres", "Minimum acres", d?.min_acres ?? 0],
          ["max_acres", "Maximum acres", d?.max_acres ?? 20],
          ["max_price", "Maximum price", d?.max_price ?? 750000],
        ].map(([name, label, value]) => (
          <label key={name}>
            {label}
            <input
              name={String(name)}
              type="number"
              min={name === "min_acres" ? 0 : 0.001}
              step={name === "max_price" ? "0.01" : "0.001"}
              defaultValue={value}
              required
            />
          </label>
        ))}
        <label>
          Preferred zoning (comma separated)
          <input
            name="zoning"
            maxLength={1000}
            defaultValue={d?.zoning.join(", ")}
          />
        </label>
      </div>
      <label>
        Developer preferences
        <textarea
          name="preferences"
          maxLength={1000}
          defaultValue={d?.preferences}
        />
      </label>
      <label>
        Developer email
        <input
          name="email"
          type="email"
          maxLength={254}
          defaultValue={d?.email}
        />
      </label>
      <label className="checkbox">
        <input
          name="email_opt_in"
          type="checkbox"
          defaultChecked={d?.email_opt_in}
        />
        Current email permission
      </label>
      <label>
        Developer permission evidence
        <textarea
          name="permission_evidence"
          maxLength={2000}
          defaultValue={d?.permission_evidence}
        />
      </label>
      {!d && (
        <label className="checkbox">
          <input name="is_demo" type="checkbox" defaultChecked />
          Fictitious DEMO developer
        </label>
      )}
      <label className="checkbox">
        <input
          name="active"
          type="checkbox"
          defaultChecked={d?.active ?? true}
        />
        Active developer
      </label>
      <button className="button secondary">
        {d ? "Save developer preferences" : "Add developer"}
      </button>
    </form>
  );
}
export function PropertyPartners({
  data,
  run,
}: {
  data: PropertyData;
  run: PropertyRun;
}) {
  return (
    <>
      <section className="panel">
        <h2>Developer preferences</h2>
        <p>
          Matching uses region, acreage, price and zoning. Editing preferences
          or permission invalidates unsent form approvals.
        </p>
        <button
          className="button secondary"
          onClick={() => void run("demo-developers")}
        >
          Load demo developers
        </button>
        {data.developers.map((d) => (
          <details key={d.id} className="claim-row">
            <summary>
              {d.name} · {d.region} · {d.is_demo ? "DEMO" : "Supplied partner"}
            </summary>
            <DeveloperEditor key={d.revision} developer={d} run={run} />
          </details>
        ))}
      </section>
      <section className="panel">
        <h2>Add a developer</h2>
        <DeveloperEditor run={run} />
      </section>
    </>
  );
}
function Payload({ form }: { form: PartnerForm }) {
  return (
    <dl className="property-payload">
      {Object.entries(form.payload).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replaceAll("_", " ")}</dt>
          <dd>{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PartnerForms({
  data,
  run,
}: {
  data: PropertyData;
  run: PropertyRun;
}) {
  return (
    <>
      <section className="panel">
        <h2>Partner forms</h2>
        <p>
          Latest 200 forms. Prepare a form from a property’s developer matches.
          A second administrator must review each version before simulation.
        </p>
        {!data.forms.length && (
          <p>
            No forms yet. Select a property and create a form from a developer
            match.
          </p>
        )}
        {data.forms.map((f) => (
          <article className="claim-row" key={f.id}>
            <h3>
              {data.developers.find((d) => d.id === f.partner_id)?.name ??
                "Partner form"}{" "}
              <span className="pill">{f.status.replaceAll("_", " ")}</span>
            </h3>
            <p>
              Version {f.version} · Property revision {f.property_revision} ·
              Partner revision {f.partner_revision}
            </p>
            {f.invalid_reason && (
              <p className="notice error">{f.invalid_reason}</p>
            )}
            <Payload form={f} />
            {f.status !== "SIMULATED_SENT" && (
              <>
                <details>
                  <summary>Edit mapped form fields</summary>
                  <form
                    key={f.version}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const fields = Object.fromEntries(
                        Object.keys(f.payload)
                          .filter((k) => !k.startsWith("_"))
                          .map((k) => [k, field(form, k)]),
                      );
                      void run("form-edit", {
                        id: f.id,
                        regenerate: false,
                        fields,
                      });
                    }}
                  >
                    {Object.entries(f.payload)
                      .filter(([k]) => !k.startsWith("_"))
                      .map(([k, v]) => (
                        <label key={k}>
                          {k.replaceAll("_", " ")}
                          <textarea
                            name={k}
                            aria-label={k.replaceAll("_", " ")}
                            defaultValue={String(v)}
                            maxLength={2000}
                          />
                        </label>
                      ))}
                    <button className="button secondary">
                      Save edited form
                    </button>
                  </form>
                </details>
                <div className="row property-actions">
                  <button
                    className="button secondary"
                    onClick={() =>
                      void run("form-edit", { id: f.id, regenerate: true })
                    }
                  >
                    Regenerate from current facts
                  </button>
                  {["DRAFT", "REJECTED"].includes(f.status) && (
                    <button
                      className="button"
                      onClick={() => void run("form-submit", { id: f.id })}
                    >
                      Submit for independent review
                    </button>
                  )}
                </div>
                {f.status === "APPROVED" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("form-simulate", {
                        id: f.id,
                        demo_attestation: new FormData(e.currentTarget).has(
                          "demo_attestation",
                        ),
                      });
                    }}
                  >
                    <label className="checkbox">
                      <input name="demo_attestation" type="checkbox" required />
                      I understand this creates a DEMO receipt and sends nothing
                    </label>
                    <button className="button">
                      Simulate approved delivery
                    </button>
                  </form>
                )}
              </>
            )}
            <details>
              <summary>Review and delivery history</summary>
              {data.reviews
                .filter((r) => r.form_id === f.id)
                .map((r) => (
                  <p key={r.id}>
                    v{r.version} · {r.decision} · {r.note} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                ))}
              {data.deliveries
                .filter((r) => r.form_id === f.id)
                .map((r) => (
                  <div className="notice" key={r.id}>
                    <strong>DEMO · SIMULATED SENT · No live delivery</strong>
                    <p>
                      Receipt {r.provider_reference} · v{r.form_version}
                    </p>
                    <p>
                      {String(r.recipient_snapshot.name)} ·{" "}
                      {String(r.recipient_snapshot.email)}
                    </p>
                  </div>
                ))}
            </details>
          </article>
        ))}
      </section>
    </>
  );
}
export function PropertyReview({
  data,
  run,
}: {
  data: PropertyData;
  run: PropertyRun;
}) {
  const admin = data.admin!;
  const [documentError, setDocumentError] = useState("");
  async function openEvidence(id: string) {
    setDocumentError("");
    try {
      const r = await fetch("/api/real-estate/evidence?id=" + id);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDocumentError((e as Error).message);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Independent property claim review</h2>
        <p>
          Latest 100 pending claims. Owners cannot approve their own claims.
          Uploaded documents are unscanned; DEMO review does not verify real
          property.
        </p>
        {documentError && <p role="alert">{documentError}</p>}
        {admin.claims
          .filter((c) =>
            admin.properties.some(
              (p) => p.id === c.property_id && p.owner_id !== data.userId,
            ),
          )
          .map((c) => {
            const p = admin.properties.find((p) => p.id === c.property_id)!,
              evidence = admin.evidence.find((e) => e.id === c.evidence_id);
            return (
              <article className="claim-row" key={c.id}>
                <h3>
                  {p.address} · {p.is_demo ? "DEMO · " : ""}
                  {c.claim_key}
                </h3>
                <p>Claim: {c.claimed_value}</p>
                <p>
                  Evidence: {evidence?.label ?? c.evidence_id} ·{" "}
                  {evidence?.status}
                </p>
                <p>{evidence?.content_note}</p>
                {evidence?.status === "UPLOADED_UNSCANNED" && (
                  <button
                    className="button secondary"
                    onClick={() => void openEvidence(evidence.id)}
                  >
                    Inspect private evidence
                  </button>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run("claim-review", {
                      id: c.id,
                      decision: field(f, "decision"),
                      note: field(f, "note"),
                    });
                  }}
                >
                  <Select
                    name="decision"
                    label="Claim decision"
                    options={["UNVERIFIED", "VERIFIED", "REJECTED"]}
                  />
                  <label>
                    Claim review explanation
                    <textarea
                      name="note"
                      required
                      minLength={5}
                      maxLength={2000}
                    />
                  </label>
                  <button className="button">
                    Record independent claim review
                  </button>
                </form>
              </article>
            );
          })}
      </section>
      <section className="panel">
        <h2>Independent partner form review</h2>
        <p>
          Latest 100 forms. Review the current payload, evidence disclosures and
          provenance before deciding.
        </p>
        {admin.forms
          .filter(
            (f) => f.owner_id !== data.userId && f.status === "PENDING_REVIEW",
          )
          .map((f) => (
            <article className="claim-row" key={f.id}>
              <h3>
                Form v{f.version} ·{" "}
                {admin.developers.find((d) => d.id === f.partner_id)?.name ??
                  f.partner_id}
              </h3>
              <Payload form={f} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = new FormData(e.currentTarget);
                  void run("form-review", {
                    id: f.id,
                    decision: field(input, "decision"),
                    note: field(input, "note"),
                    acknowledge_unverified: input.has("acknowledge_unverified"),
                  });
                }}
              >
                <Select
                  name="decision"
                  label="Form decision"
                  options={["REJECTED", "APPROVED"]}
                />
                <label>
                  Form review explanation
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                <label className="checkbox">
                  <input
                    name="acknowledge_unverified"
                    type="checkbox"
                    required
                  />
                  I reviewed the verification disclosures and understand any
                  DEMO status
                </label>
                <button className="button">
                  Record independent form review
                </button>
              </form>
            </article>
          ))}
      </section>
      <section className="panel">
        <h2>Partner template versions</h2>
        <p>
          Create an immutable template version for a specific partner. Existing
          versions are retained.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const field_mapping = Object.fromEntries(
              [1, 2, 3]
                .map((n) => [field(f, "target" + n), field(f, "source" + n)])
                .filter(([target]) => target),
            );
            void run("partner-template", {
              partner_id: field(f, "partner_id"),
              template_key: field(f, "template_key"),
              version: Number(field(f, "version")),
              title: field(f, "title"),
              field_mapping,
              approved: f.has("approved"),
            });
          }}
        >
          <label>
            Template partner
            <select name="partner_id" required>
              <option value="">Select a partner</option>
              {admin.developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Template key
              <input
                name="template_key"
                required
                pattern="[a-z0-9-]+"
                maxLength={100}
              />
            </label>
            <label>
              Template version
              <input
                name="version"
                type="number"
                required
                min={1}
                step={1}
                defaultValue={1}
              />
            </label>
            <label>
              Template title
              <input name="title" required minLength={3} maxLength={120} />
            </label>
          </div>
          {[1, 2, 3].map((n) => (
            <div className="form-grid" key={n}>
              <label>
                Partner field {n}
                <input
                  name={"target" + n}
                  required={n === 1}
                  pattern="[A-Za-z][A-Za-z0-9_]{0,49}"
                  maxLength={50}
                />
              </label>
              <Select
                name={"source" + n}
                label={"Property source " + n}
                options={templateSources}
              />
            </div>
          ))}
          <label className="checkbox">
            <input name="approved" type="checkbox" />
            Approve this template version
          </label>
          <button className="button">Create partner template version</button>
        </form>
        {admin.templates.map((t) => (
          <p key={t.id}>
            {t.title} · v{t.version} · {t.approved ? "APPROVED" : "UNAPPROVED"}{" "}
            · {t.is_demo ? "DEMO" : "Partner template"}
          </p>
        ))}
      </section>
    </>
  );
}
