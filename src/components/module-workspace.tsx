"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModuleData, Listing, Module } from "@/features/modules/domain";
import { moduleLabels, formatPrice } from "@/features/modules/domain";
import { WorkspaceLoader } from "./workspace-loader";
import {
  ListingEditor,
  ListingManagement,
  AgentProfile,
} from "./module-listings";
import {
  TalentProfile,
  TalentMatches,
  ModuleInbox,
  EventTickets,
  ModuleReviews,
} from "./module-workflows";
import { NavIcon } from "./brand";
import { field } from "./ui";
export type ModuleRun = (action: string, data: unknown) => Promise<unknown>;
export function ModuleWorkspace({ section }: { section: string }) {
  const router = useRouter(),
    lock = useRef(false);
  const initial =
    section === "talent" ? "TALENT" : section === "events" ? "EVENT" : "MARKET";
  const [filter, setFilter] = useState(initial),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("browse");
  const [data, setData] = useState<ModuleData | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Listing | null>(null),
    [createKind, setCreateKind] = useState<Module>(
      section === "talent"
        ? "TALENT"
        : section === "events"
          ? "EVENT"
          : "YACHT",
    );
  const params = useCallback(
    () =>
      new URLSearchParams({ module: filter, page: String(page), q: search }),
    [filter, page, search],
  );
  const load = useCallback(async () => {
    const r = await fetch("/api/modules?" + params(), { cache: "no-store" });
    if (r.status === 401) {
      router.replace("/login");
      return;
    }
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Unable to load this module.");
    setData(body);
  }, [params, router]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/modules?" + params(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Unable to load module.");
        setData(body);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [params, router]);
  const run: ModuleRun = async (action, input) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: input }),
      });
      const body = await r.json();
      if (!r.ok)
        throw new Error(body.error ?? "Unable to complete this action.");
      await load();
      setSelected(null);
      setMessage(
        action === "register"
          ? "Registration recorded. Free or DEMO only; no payment was collected."
          : "Saved successfully.",
      );
      return body.result ?? true;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const relevant = (l: Listing) =>
    section === "talent"
      ? l.module === "TALENT"
      : section === "events"
        ? l.module === "EVENT"
        : ["YACHT", "AVIATION", "VEHICLE"].includes(l.module);
  return (
    <div className="module-workspace">
      <div className="notice">
        Preview: DEMO records are fictitious. Content review does not verify
        identities or inventory. Inquiries stay in the app; external sending and
        live paid checkout are unavailable.
      </div>
      <div
        className="filter-bar module-tabs"
        role="tablist"
        aria-label="Module sections"
      >
        {[
          "browse",
          "your listings",
          ...(section === "talent" ? ["talent profile", "matching"] : []),
          ...(section === "marketplace" ? ["agent profile"] : []),
          "inbox",
          ...(section === "events" ? ["tickets"] : []),
          ...(data?.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r))
            ? ["reviews"]
            : []),
        ].map((t) => (
          <button
            role="tab"
            key={t}
            aria-selected={tab === t}
            className={"button " + (tab === t ? "" : "secondary")}
            onClick={() => {
              setTab(t);
              setSelected(null);
              setError("");
              setMessage("");
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            Reload module
          </button>
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {!data ? (
        !error && <WorkspaceLoader />
      ) : (
        <fieldset disabled={busy} className="workspace-fields" aria-busy={busy}>
          {tab === "browse" && (
            <>
              <form
                className="filter-bar property-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setSearch(field(f, "search"));
                  setPage(0);
                }}
              >
                <label>
                  Search listings
                  <input name="search" maxLength={100} defaultValue={search} />
                </label>
                {section === "marketplace" && (
                  <label>
                    Marketplace category
                    <select
                      aria-label="Marketplace category"
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="MARKET">All marketplace</option>
                      {(["YACHT", "AVIATION", "VEHICLE"] as Module[]).map(
                        (m) => (
                          <option key={m} value={m}>
                            {moduleLabels[m]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                <button className="button secondary">Search</button>
              </form>
              <div className="section-heading">
                <h2>
                  {section === "talent"
                    ? "Recruitment opportunities"
                    : section === "events"
                      ? "Upcoming events"
                      : "Discover the marketplace"}
                </h2>
                <span className="fine">
                  {data.listings.length} listings on this page
                </span>
              </div>
              <div className="module-listing-grid">
                {data.listings.map((l) => (
                  <button
                    className="module-listing-card"
                    key={l.id}
                    onClick={() => setSelected(l)}
                  >
                    <span
                      className={
                        "module-card-art module-art-" + l.module.toLowerCase()
                      }
                    >
                      <span className="badge">
                        {l.is_demo
                          ? "DEMO · FICTITIOUS"
                          : "UNVERIFIED INVENTORY"}
                      </span>
                      <NavIcon
                        name={
                          l.module === "TALENT"
                            ? "matches"
                            : l.module === "EVENT"
                              ? "events"
                              : l.module === "VEHICLE"
                                ? "vehicles"
                                : "properties"
                        }
                      />
                      <small>{moduleLabels[l.module]}</small>
                    </span>
                    <strong>{l.title}</strong>
                    <span>{l.region}</span>
                    <small>
                      {l.module === "EVENT"
                        ? new Date(String(l.facts.starts_at)).toLocaleString()
                        : l.module === "TALENT"
                          ? String(l.facts.kind)
                          : l.module === "VEHICLE"
                            ? String(l.facts.seller_type)
                            : String(l.facts.offer)}
                    </small>
                    <b>
                      {formatPrice(l.price_minor, l.currency)}
                      {l.module === "EVENT" ? " / ticket" : ""}
                    </b>
                  </button>
                ))}
              </div>
              {!data.listings.length && (
                <div className="empty">
                  <h3>No listings found</h3>
                  <p>Try another search, or create an authorized listing.</p>
                </div>
              )}
              <div className="row">
                <button
                  className="button secondary"
                  disabled={!page}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  className="button secondary"
                  disabled={!data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
              {selected && (
                <ListingDetail
                  key={selected.id}
                  listing={selected}
                  data={data}
                  run={run}
                  close={() => setSelected(null)}
                />
              )}
            </>
          )}
          {tab === "your listings" && (
            <>
              <section className="panel">
                <h2>Create a listing</h2>
                <p>
                  Requires an assigned RECRUITER, SELLER, AGENT or ORGANIZER
                  role for the selected module. Ask your administrator to
                  approve the appropriate role. All new listings start as
                  drafts.
                </p>
                {section === "marketplace" && (
                  <label>
                    Listing module
                    <select
                      aria-label="Listing module"
                      value={createKind}
                      onChange={(e) => setCreateKind(e.target.value as Module)}
                    >
                      {(["YACHT", "AVIATION", "VEHICLE"] as Module[]).map(
                        (m) => (
                          <option value={m} key={m}>
                            {moduleLabels[m]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                <ListingEditor
                  key={createKind}
                  kind={createKind}
                  data={data}
                  run={run}
                />
              </section>
              <ListingManagement
                data={data}
                listings={data.owned.filter(relevant)}
                run={run}
              />
              {section === "marketplace" && (
                <section className="panel">
                  <h2>Your agent assignments</h2>
                  {!data.assignments.length && (
                    <p>No listings are assigned to you.</p>
                  )}
                  {data.assignments.map((l) => (
                    <article className="claim-row" key={l.id}>
                      <h3>
                        {l.title} · v{l.revision}
                      </h3>
                      <p>{l.summary}</p>
                      <Facts listing={l} />
                      <p>
                        Content status: {l.status}.{" "}
                        {l.is_demo
                          ? "DEMO · Fictitious inventory."
                          : "Inventory and identity remain unverified."}
                      </p>
                      {l.agent_accepted_revision === l.revision ? (
                        <span className="badge">Current revision accepted</span>
                      ) : (
                        <button
                          className="button secondary"
                          onClick={() =>
                            void run("listing-action", {
                              id: l.id,
                              action: "accept-agent",
                            })
                          }
                        >
                          Accept agent assignment
                        </button>
                      )}
                    </article>
                  ))}
                </section>
              )}
            </>
          )}
          {tab === "talent profile" && <TalentProfile data={data} run={run} />}
          {tab === "matching" && <TalentMatches data={data} />}
          {tab === "agent profile" && <AgentProfile data={data} run={run} />}
          {tab === "inbox" && <ModuleInbox data={data} run={run} />}
          {tab === "tickets" && <EventTickets data={data} run={run} />}
          {tab === "reviews" && <ModuleReviews data={data} run={run} />}
        </fieldset>
      )}
    </div>
  );
}
export function Facts({ listing }: { listing: Listing }) {
  return (
    <dl className="property-payload">
      {Object.entries(listing.facts).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replaceAll("_", " ")}</dt>
          <dd>
            {Array.isArray(v)
              ? v.join(", ")
              : typeof v === "boolean"
                ? v
                  ? "Yes"
                  : "No"
                : k.endsWith("_at")
                  ? new Date(String(v)).toLocaleString()
                  : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ListingDetail({
  listing: l,
  data,
  run,
  close,
}: {
  listing: Listing;
  data: ModuleData;
  run: ModuleRun;
  close: () => void;
}) {
  const requestKey = useRef(crypto.randomUUID());
  return (
    <section className="panel module-detail" aria-label="Listing detail">
      <div className="section-heading">
        <h2>{l.title}</h2>
        <button className="text-button" onClick={close}>
          Close details
        </button>
      </div>
      <span className={"badge " + (l.is_demo ? "demo" : "")}>
        {l.is_demo ? "DEMO · FICTITIOUS" : "SUPPLIED · UNVERIFIED"}
      </span>
      <p>{l.summary}</p>
      <p>
        {l.region} · {formatPrice(l.price_minor, l.currency)}
      </p>
      <Facts listing={l} />
      {l.module === "TALENT" &&
        (l.owner_id && l.owner_id !== data.userId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("apply", {
                listing_id: l.id,
                message: field(new FormData(e.currentTarget), "message"),
              });
            }}
          >
            <p>
              A matching opted-in talent profile and current platform matching
              consent are required. Your message and current talent profile
              snapshot are shared privately with the recruiter and retained with
              the application.
            </p>
            <label>
              Application message
              <textarea
                name="message"
                minLength={10}
                maxLength={2000}
                required
              />
            </label>
            <button
              className="button"
              disabled={
                !data.candidate?.discoverable ||
                !data.matchingConsent ||
                data.applications.some(
                  (a) =>
                    a.listing_id === l.id && a.applicant_id === data.userId,
                )
              }
            >
              Apply to opportunity
            </button>
          </form>
        ) : (
          <p>
            {l.owner_id
              ? "You own this opportunity."
              : "Global demo opportunity: browse matching only. No real employer or application destination exists."}
          </p>
        ))}
      {["YACHT", "AVIATION", "VEHICLE"].includes(l.module) &&
        (l.owner_id && l.owner_id !== data.userId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("inquiry", {
                listing_id: l.id,
                message: field(f, "message"),
                attested: f.has("attested"),
              });
            }}
          >
            <p>
              Private in-app inquiry to the owner
              {l.agent_id ? " and currently assigned agent" : ""}. No external
              message is sent.
            </p>
            <label>
              Inquiry message
              <textarea
                name="message"
                minLength={10}
                maxLength={2000}
                required
              />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="attested" required />I consent to
              share this inquiry with the owner and assigned agent
            </label>
            <button
              className="button"
              disabled={
                !data.matchingConsent ||
                data.inquiries.some(
                  (r) => r.listing_id === l.id && r.sender_id === data.userId,
                )
              }
            >
              Request details
            </button>
          </form>
        ) : (
          <p>
            {l.owner_id
              ? "You own this listing."
              : "Global DEMO listing: no real seller, agent or inquiry destination."}
          </p>
        ))}
      {l.module === "EVENT" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run("register", {
              listing_id: l.id,
              request_key: requestKey.current,
              quantity: Number(field(f, "quantity")),
              attested: f.has("attested"),
              demo_attestation: f.has("demo_attestation"),
            });
          }}
        >
          <h3>
            {l.is_demo
              ? "Demo registration"
              : Number(l.price_minor) === 0
                ? "Free registration"
                : "Paid checkout unavailable"}
          </h3>
          <p>
            {l.is_demo
              ? "Simulation only. No charge or real admission."
              : Number(l.price_minor) > 0
                ? "Live payment is blocked until a provider is configured. No card details are collected."
                : "Registration issues a free ticket; no payment is collected."}
          </p>
          <label>
            Ticket quantity
            <input
              name="quantity"
              type="number"
              min={1}
              max={5}
              step={1}
              defaultValue={1}
              required
            />
          </label>
          <label className="checkbox">
            <input name="attested" type="checkbox" required />I agree to
            register for the event shown above
          </label>
          {l.is_demo && (
            <label className="checkbox">
              <input name="demo_attestation" type="checkbox" required />I
              understand this is DEMO checkout with no charge or real admission
            </label>
          )}
          <button
            className="button"
            disabled={!l.is_demo && Number(l.price_minor) > 0}
          >
            {l.is_demo
              ? "Simulate checkout"
              : Number(l.price_minor) > 0
                ? "Live checkout blocked"
                : "Register free"}
          </button>
        </form>
      )}
    </section>
  );
}
