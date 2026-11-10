"use client";
import type { Module, ModuleData, Listing } from "@/features/modules/domain";
import { moduleLabels, formatPrice } from "@/features/modules/domain";
import type { ModuleRun } from "./module-workspace";
import { field } from "./ui";
type Spec = {
  key: string;
  label: string;
  type?: "number" | "checkbox" | "datetime-local";
  options?: string[];
  min?: number;
  max?: number;
  step?: string;
};
const specs: Record<Module, Spec[]> = {
  TALENT: [
    {
      key: "kind",
      label: "Opportunity kind",
      options: ["JOB", "TESTER", "COMMISSION"],
    },
    { key: "skills", label: "Required skills (comma separated)" },
    { key: "remote", label: "Remote opportunity", type: "checkbox" },
    { key: "engagement", label: "Engagement / compensation terms" },
  ],
  YACHT: [
    {
      key: "length_m",
      label: "Length (metres)",
      type: "number",
      min: 1,
      max: 300,
      step: "0.01",
    },
    { key: "year", label: "Build year", type: "number", min: 1900, max: 2100 },
    {
      key: "guests",
      label: "Guest capacity",
      type: "number",
      min: 1,
      max: 1000,
    },
    { key: "offer", label: "Offer type", options: ["SALE", "CHARTER"] },
  ],
  AVIATION: [
    { key: "make", label: "Manufacturer" },
    { key: "model", label: "Aircraft model" },
    { key: "year", label: "Build year", type: "number", min: 1900, max: 2100 },
    {
      key: "seats",
      label: "Passenger seats",
      type: "number",
      min: 1,
      max: 1000,
    },
    {
      key: "hours",
      label: "Airframe hours",
      type: "number",
      min: 0,
      max: 1000000,
      step: "0.1",
    },
    { key: "offer", label: "Offer type", options: ["SALE", "CHARTER"] },
  ],
  VEHICLE: [
    { key: "make", label: "Vehicle make" },
    { key: "model", label: "Vehicle model" },
    { key: "year", label: "Model year", type: "number", min: 1900, max: 2100 },
    {
      key: "mileage_km",
      label: "Mileage (km)",
      type: "number",
      min: 0,
      max: 10000000,
      step: "0.1",
    },
    { key: "fuel", label: "Fuel / power type" },
    { key: "seller_type", label: "Seller type", options: ["DEALER", "BROKER"] },
  ],
  EVENT: [
    {
      key: "starts_at",
      label: "Event starts (your local time)",
      type: "datetime-local",
    },
    {
      key: "ends_at",
      label: "Event ends (your local time)",
      type: "datetime-local",
    },
    {
      key: "closes_at",
      label: "Registration closes (your local time)",
      type: "datetime-local",
    },
    { key: "venue", label: "Venue" },
    {
      key: "capacity",
      label: "Total ticket capacity",
      type: "number",
      min: 1,
      max: 10000,
    },
  ],
};
function localDate(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function ListingEditor({
  kind,
  data,
  run,
  listing: l,
}: {
  kind: Module;
  data: ModuleData;
  run: ModuleRun;
  listing?: Listing;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const facts = Object.fromEntries(
          specs[kind].map((s) => [
            s.key,
            s.type === "checkbox"
              ? f.has(s.key)
              : s.type === "number"
                ? Number(field(f, s.key))
                : s.type === "datetime-local"
                  ? new Date(field(f, s.key)).toISOString()
                  : s.key === "skills"
                    ? field(f, s.key)
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean)
                    : field(f, s.key),
          ]),
        );
        const price = field(f, "price");
        void run("listing-save", {
          ...(l ? { id: l.id } : {}),
          module: kind,
          title: field(f, "title"),
          region: field(f, "region"),
          summary: field(f, "summary"),
          facts,
          price_minor: price === "" ? null : Math.round(Number(price) * 100),
          currency: field(f, "currency"),
          is_demo: l?.is_demo ?? f.has("is_demo"),
          agent_id: ["YACHT", "AVIATION"].includes(kind)
            ? field(f, "agent_id")
            : null,
        });
      }}
    >
      <div className="form-grid">
        <label>
          Listing title
          <input
            name="title"
            required
            minLength={3}
            maxLength={140}
            defaultValue={l?.title}
          />
        </label>
        <label>
          Listing region
          <input
            name="region"
            required
            minLength={2}
            maxLength={100}
            defaultValue={l?.region}
          />
        </label>
      </div>
      <label>
        Listing description
        <textarea
          name="summary"
          aria-label="Listing description"
          required
          minLength={10}
          maxLength={2000}
          defaultValue={l?.summary}
        />
      </label>
      <div className="form-grid">
        {specs[kind].map((s) => (
          <label
            key={s.key}
            className={s.type === "checkbox" ? "checkbox" : ""}
          >
            {s.type === "checkbox" ? (
              <>
                <input
                  type="checkbox"
                  name={s.key}
                  defaultChecked={Boolean(l?.facts[s.key])}
                />
                {s.label}
              </>
            ) : (
              <>
                {s.label}
                {s.options ? (
                  <select
                    name={s.key}
                    aria-label={s.label}
                    defaultValue={String(l?.facts[s.key] ?? s.options[0])}
                  >
                    {s.options.map((o) => (
                      <option value={o} key={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={s.key}
                    aria-label={s.label}
                    type={s.type ?? "text"}
                    required
                    maxLength={
                      s.key === "engagement"
                        ? 240
                        : s.key === "skills"
                          ? 1000
                          : s.key === "venue"
                            ? 240
                            : 100
                    }
                    min={s.min}
                    max={s.max}
                    step={s.step ?? "1"}
                    defaultValue={
                      s.type === "datetime-local"
                        ? localDate(l?.facts[s.key])
                        : Array.isArray(l?.facts[s.key])
                          ? (l!.facts[s.key] as string[]).join(", ")
                          : String(l?.facts[s.key] ?? "")
                    }
                  />
                )}
              </>
            )}
          </label>
        ))}
      </div>
      <div className="form-grid">
        <label>
          {kind === "TALENT"
            ? "Compensation amount"
            : kind === "EVENT"
              ? "Price per ticket"
              : "Asking price / charter rate"}
          <input
            name="price"
            type="number"
            min={0}
            max={1000000000}
            step="0.01"
            required={["EVENT", "TALENT"].includes(kind)}
            defaultValue={
              l?.price_minor == null ? "" : Number(l.price_minor) / 100
            }
          />
        </label>
        <label>
          Currency
          <select name="currency" defaultValue={l?.currency ?? "USD"}>
            {["USD", "PKR", "EUR", "GBP"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {["YACHT", "AVIATION"].includes(kind) && (
        <label>
          Assigned agent
          <select
            name="agent_id"
            aria-label="Assigned agent"
            required
            defaultValue={l?.agent_id ?? ""}
          >
            <option value="">Choose an opted-in agent</option>
            {data.agents
              .filter((a) => a.active)
              .map((a) => (
                <option key={a.owner_id} value={a.owner_id}>
                  {a.display_name} · {a.business_name}
                </option>
              ))}
          </select>
        </label>
      )}
      {!l && (
        <label className="checkbox">
          <input type="checkbox" name="is_demo" defaultChecked />
          Fictitious DEMO record
        </label>
      )}
      <p className="fine">
        Submitted facts are unverified. Edits create a new draft and invalidate
        content approval and agent acceptance. Events with active orders must be
        cancelled before editing.
      </p>
      <button className="button secondary">
        {l ? "Save revised listing" : "Save listing draft"}
      </button>
    </form>
  );
}
export function ListingManagement({
  data,
  listings,
  run,
}: {
  data: ModuleData;
  listings: Listing[];
  run: ModuleRun;
}) {
  return (
    <section className="panel">
      <h2>Your listing drafts & publications</h2>
      <p className="fine">
        Latest 100 owned listings. Content approval is separate from
        identity/inventory verification.
      </p>
      {!listings.length && <p>No listings yet.</p>}
      {listings.map((l) => (
        <article className="claim-row" key={l.id}>
          <h3>
            {l.title} <span className="badge">{l.status}</span>
          </h3>
          <p>
            {moduleLabels[l.module]} · {l.is_demo ? "DEMO · " : ""}Revision{" "}
            {l.revision} · {formatPrice(l.price_minor, l.currency)}
          </p>
          {l.agent_id && (
            <p>
              Agent:{" "}
              {data.agents.find((a) => a.owner_id === l.agent_id)
                ?.display_name ?? l.agent_id}{" "}
              ·{" "}
              {l.agent_accepted_revision === l.revision
                ? "Current revision accepted"
                : "Acceptance required"}
            </p>
          )}
          <details>
            <summary>Edit listing</summary>
            <ListingEditor
              key={l.revision}
              kind={l.module}
              listing={l}
              data={data}
              run={run}
            />
          </details>
          <div className="row property-actions">
            {l.status === "DRAFT" && (
              <button
                className="button"
                onClick={() =>
                  void run("listing-action", { id: l.id, action: "submit" })
                }
              >
                Submit listing for review
              </button>
            )}
            {l.status !== "ARCHIVED" && (
              <button
                className="button secondary"
                onClick={() =>
                  void run("listing-action", { id: l.id, action: "archive" })
                }
              >
                Archive listing
              </button>
            )}
          </div>
          {data.reviews
            .filter((r) => r.listing_id === l.id)
            .map((r) => (
              <p className="fine" key={r.id}>
                v{r.revision} · {r.decision} · {r.note}
              </p>
            ))}
        </article>
      ))}
    </section>
  );
}
export function AgentProfile({
  data,
  run,
}: {
  data: ModuleData;
  run: ModuleRun;
}) {
  const a = data.agents.find((a) => a.owner_id === data.userId);
  return (
    <section className="panel">
      <h2>Agent assignment preferences</h2>
      <p>
        An administrator must first assign your AGENT role. Opting in lets
        listing owners request your involvement; each listing revision still
        requires your explicit acceptance. This does not verify professional
        credentials.
      </p>
      <form
        key={(a?.updated_at as string) ?? "new"}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run("agent-save", {
            display_name: field(f, "display_name"),
            business_name: field(f, "business_name"),
            active: f.has("active"),
          });
        }}
      >
        <label>
          Agent display name
          <input
            name="display_name"
            minLength={2}
            maxLength={100}
            required
            defaultValue={a?.display_name}
          />
        </label>
        <label>
          Agent business name
          <input
            name="business_name"
            maxLength={140}
            defaultValue={a?.business_name}
          />
        </label>
        <label className="checkbox">
          <input name="active" type="checkbox" defaultChecked={a?.active} />I
          opt in to receive assignment requests
        </label>
        <button className="button">Save agent preferences</button>
      </form>
    </section>
  );
}
