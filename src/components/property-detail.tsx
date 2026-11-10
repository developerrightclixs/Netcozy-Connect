"use client";
import { useState } from "react";
import {
  listingStates,
  rankDevelopers,
  type Property,
} from "@/features/real-estate/domain";
import type { PropertyData, PropertyRun } from "./property-workspace";
import { field, Select } from "./ui";
const facts = [
  ["address", "Address"],
  ["region", "Region"],
  ["postal_code", "Postal code"],
  ["lot_acres", "Lot acres"],
  ["zoning", "Zoning"],
  ["utilities", "Utilities"],
  ["road_access", "Road access"],
  ["asking_price", "Asking price"],
  ["source", "Source"],
  ["license_evidence", "License / authorization evidence"],
] as const;
export function PropertyEditor({
  property,
  run,
}: {
  property?: Property;
  run: PropertyRun;
}) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const input = Object.fromEntries(
          facts.map(([k]) => [
            k,
            ["lot_acres", "asking_price"].includes(k)
              ? Number(field(f, k))
              : field(f, k),
          ]),
        );
        await run(property ? "property-edit" : "property", {
          ...input,
          listing_status: field(f, "listing_status"),
          attested: f.has("attested"),
          ...(property ? { id: property.id } : { is_demo: f.has("is_demo") }),
        });
      }}
    >
      <div className="form-grid">
        {facts.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              defaultValue={property?.[key] ?? ""}
              required={[
                "address",
                "region",
                "lot_acres",
                "asking_price",
                "source",
                "license_evidence",
              ].includes(key)}
              maxLength={
                key === "license_evidence"
                  ? 2000
                  : key === "address" ||
                      key === "utilities" ||
                      key === "road_access"
                    ? 240
                    : key === "source"
                      ? 200
                      : key === "postal_code"
                        ? 20
                        : 100
              }
              minLength={
                key === "license_evidence"
                  ? 5
                  : key === "source" || key === "address"
                    ? 3
                    : key === "region"
                      ? 2
                      : undefined
              }
              type={
                key === "lot_acres" || key === "asking_price"
                  ? "number"
                  : "text"
              }
              min={
                key === "lot_acres"
                  ? "0.001"
                  : key === "asking_price"
                    ? "0"
                    : undefined
              }
              step={
                key === "lot_acres"
                  ? "0.001"
                  : key === "asking_price"
                    ? "0.01"
                    : undefined
              }
            />
          </label>
        ))}
      </div>
      <Select
        name="listing_status"
        label="Listing status"
        options={listingStates}
        defaultValue={property?.listing_status}
      />
      {!property && (
        <label className="checkbox">
          <input type="checkbox" name="is_demo" defaultChecked />
          Fictitious DEMO property
        </label>
      )}
      <label className="checkbox">
        <input type="checkbox" name="attested" required />I have authorization
        to record these facts and their provenance
      </label>
      <button className="button">
        {property ? "Save property facts" : "Add property"}
      </button>
    </form>
  );
}
export function PropertyDetail({
  property: p,
  data,
  run,
  upload,
}: {
  property: Property;
  data: PropertyData;
  run: PropertyRun;
  upload: (form: HTMLFormElement) => Promise<void>;
}) {
  const [downloadError, setDownloadError] = useState("");
  const contact = data.contacts[0],
    claims = data.claims.filter((c) => c.property_id === p.id),
    evidence = data.evidence.filter((e) => e.property_id === p.id);
  const matches = rankDevelopers(
    p,
    data.developers,
    claims,
    data.matchingConsent,
  );
  async function download(id: string) {
    setDownloadError("");
    try {
      const r = await fetch("/api/real-estate/evidence?id=" + id, {
        cache: "no-store",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDownloadError((e as Error).message);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>{p.address}</h2>
          <span className="pill">
            {p.is_demo ? "DEMO · FICTITIOUS" : "UNVERIFIED UNTIL REVIEWED"}
          </span>
        </div>
        <p>
          {p.region} · {p.lot_acres} acres · $
          {Number(p.asking_price).toLocaleString()} · Revision {p.revision}
        </p>
        <p className="fine">
          Source updated {new Date(p.source_updated_at).toLocaleString()}. A
          supplied fact is not a verified claim.
        </p>
        <details>
          <summary>Edit property facts</summary>
          <PropertyEditor key={p.revision} property={p} run={run} />
        </details>
      </section>
      <section className="panel">
        <h2>Private evidence</h2>
        <p>
          PDF, PNG or JPEG up to 2 MB. Files remain private; malware scanning is
          unavailable. Do not upload ID photos.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void upload(e.currentTarget);
          }}
        >
          <input type="hidden" name="property_id" value={p.id} />
          <label>
            Evidence label
            <input name="label" required minLength={3} maxLength={120} />
          </label>
          <label>
            Evidence file
            <input
              type="file"
              name="file"
              accept="application/pdf,image/png,image/jpeg"
              required
            />
          </label>
          <button className="button secondary">Upload private evidence</button>
        </form>
        {p.is_demo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("demo-evidence", {
                property_id: p.id,
                label: field(f, "label"),
                content_note: field(f, "content_note"),
              });
            }}
          >
            <h3>Fictitious evidence note</h3>
            <label>
              Demo evidence label
              <input name="label" required minLength={3} maxLength={120} />
            </label>
            <label>
              Demo evidence note
              <textarea
                name="content_note"
                required
                minLength={10}
                maxLength={2000}
              />
            </label>
            <button className="button secondary">Add demo evidence</button>
          </form>
        )}
        {downloadError && <p role="alert">{downloadError}</p>}
        {evidence.map((e) => (
          <article className="list-row" key={e.id}>
            <div>
              <strong>{e.label}</strong>
              <p>
                {e.status === "DEMO"
                  ? "DEMO · Not real evidence"
                  : e.status.replaceAll("_", " ")}{" "}
                {e.content_note}
              </p>
            </div>
            {e.status === "UPLOADED_UNSCANNED" && (
              <button
                className="text-button"
                onClick={() => void download(e.id)}
              >
                Open private document
              </button>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Claim review</h2>
        <p>
          Submit evidence for an independent administrator. Demo reviews are
          always labelled as demo.
        </p>
        {claims.map((c) => (
          <article key={c.id} className="claim-row">
            <h3>
              {c.claim_key.replaceAll("_", " ")}{" "}
              <span className="pill">
                {p.is_demo ? "DEMO · " : ""}
                {c.status}
              </span>
            </h3>
            <p>{c.claimed_value}</p>
            {c.review_note && <p>Review: {c.review_note}</p>}
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run("claim-request", {
                  property_id: p.id,
                  claim_key: c.claim_key,
                  evidence_id: field(
                    new FormData(e.currentTarget),
                    "evidence_id",
                  ),
                });
              }}
            >
              <label>
                Evidence for {c.claim_key}
                <select
                  name="evidence_id"
                  aria-label={"Evidence for " + c.claim_key}
                  required
                >
                  <option value="">Select evidence</option>
                  {evidence
                    .filter((e) =>
                      ["DEMO", "UPLOADED_UNSCANNED"].includes(e.status),
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label} ({e.status})
                      </option>
                    ))}
                </select>
              </label>
              <button className="button secondary">Request claim review</button>
            </form>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Owner contact & permission</h2>
        <form
          key={contact?.revision ?? 0}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run("contact", {
              property_id: p.id,
              name: field(f, "name"),
              email: field(f, "email"),
              phone: field(f, "phone"),
              source: field(f, "source"),
            });
          }}
        >
          <div className="form-grid">
            <label>
              Contact name
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={contact?.name}
              />
            </label>
            <label>
              Contact email
              <input
                name="email"
                type="email"
                maxLength={254}
                defaultValue={contact?.email}
              />
            </label>
            <label>
              Contact phone
              <input
                name="phone"
                maxLength={40}
                defaultValue={contact?.phone}
              />
            </label>
            <label>
              Contact source / authorization
              <input
                name="source"
                required
                minLength={5}
                maxLength={1000}
                defaultValue={contact?.source}
              />
            </label>
          </div>
          <button className="button secondary">Save owner contact</button>
        </form>
        {contact && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run("permission", {
                  contact_id: contact.id,
                  channel: field(f, "channel"),
                  granted: field(f, "decision") === "grant",
                  evidence: field(f, "evidence"),
                });
              }}
            >
              <h3>Record permission or withdrawal</h3>
              <Select
                name="channel"
                label="Permission channel"
                options={["EMAIL", "SMS", "WHATSAPP", "CALL", "POST"]}
              />
              <Select
                name="decision"
                label="Permission decision"
                options={["grant", "withdraw"]}
              />
              <label>
                Permission evidence
                <textarea
                  name="evidence"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
              <button className="button secondary">Record permission</button>
            </form>
            <details>
              <summary>Permission history</summary>
              {data.permissions
                .filter((r) => r.contact_id === contact.id)
                .map((r) => (
                  <p key={r.id}>
                    {r.channel}: {r.granted ? "Granted" : "Withdrawn"} · Contact
                    revision {r.contact_revision} · {r.evidence}
                  </p>
                ))}
            </details>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run("outreach", {
                  contact_id: contact.id,
                  channel: field(f, "channel"),
                  notes: field(f, "notes"),
                  manual_attestation: f.has("manual_attestation"),
                });
              }}
            >
              <h3>Manual outreach log</h3>
              <p>
                No messages are sent by this form. Non-note entries require
                current permission.
              </p>
              <Select
                name="channel"
                label="Log channel"
                options={["NOTE", "EMAIL", "SMS", "WHATSAPP", "CALL", "POST"]}
              />
              <label>
                Outreach notes
                <textarea
                  name="notes"
                  required
                  minLength={5}
                  maxLength={3000}
                />
              </label>
              <label className="checkbox">
                <input type="checkbox" name="manual_attestation" />I manually
                performed the recorded action (
                {p.is_demo ? "fictitious demo" : "authorized contact"})
              </label>
              <button className="button secondary">Save manual log</button>
            </form>
            {data.outreach.map((r) => (
              <p key={r.id}>
                {r.mode} · {r.channel} · {r.notes}
              </p>
            ))}
          </>
        )}
      </section>
      <section className="panel">
        <h2>Developer matches</h2>
        {!data.matchingConsent ? (
          <p>Enable matching consent in Privacy & settings.</p>
        ) : !matches.length ? (
          <p>
            No active developer fits this property’s region, acreage, budget and
            demo mode. Add preferences in Partners.
          </p>
        ) : (
          matches.map((d) => (
            <article className="claim-row" key={d.id}>
              <h3>
                {d.name} · {d.score}% fit
              </h3>
              <p>{d.reasons.join(" · ")}</p>
              <p>
                {d.is_demo ? "DEMO · " : ""}
                {d.unverified
                  ? "Some property claims remain unverified."
                  : "All property claims reviewed."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("form-create", {
                    property_id: p.id,
                    partner_id: d.id,
                    template_id: field(
                      new FormData(e.currentTarget),
                      "template_id",
                    ),
                  });
                }}
              >
                <label>
                  Approved partner template
                  <select name="template_id" required>
                    <option value="">Select a template</option>
                    {data.templates
                      .filter(
                        (t) =>
                          t.approved &&
                          t.is_demo === p.is_demo &&
                          (t.partner_id === d.id ||
                            (!t.partner_id && t.is_demo)),
                      )
                      .map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.title} v{t.version}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="button">Create partner form</button>
              </form>
            </article>
          ))
        )}
      </section>
    </>
  );
}
