"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  RealEstateData,
  Property,
  ImportRow,
} from "@/features/real-estate/domain";
import { PropertyEditor, PropertyDetail } from "./property-detail";
import {
  PropertyPartners,
  PartnerForms,
  PropertyReview,
} from "./property-partners";
import { field } from "./ui";
import { NavIcon } from "./brand";
export type PropertyData = RealEstateData & {
  selectedProperty: Property | null;
};
export type PropertyRun = (action: string, data?: unknown) => Promise<unknown>;
export function PropertyWorkspace() {
  const router = useRouter(),
    lock = useRef(false);
  const [data, setData] = useState<PropertyData | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("properties"),
    [selected, setSelected] = useState(""),
    [page, setPage] = useState(0),
    [query, setQuery] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), q: query });
    if (selected) params.set("property", selected);
    const response = await fetch("/api/real-estate?" + params, {
      cache: "no-store",
    });
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? "Unable to load properties.");
    setData(body);
  }, [page, query, selected, router]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), q: query });
    if (selected) params.set("property", selected);
    fetch("/api/real-estate?" + params, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Unable to load properties.");
        if (active) setData(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page, query, selected, router]);
  const run: PropertyRun = async (action, input) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/real-estate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: input }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Unable to save.");
      if (action !== "import-preview") {
        await load();
        setMessage(
          action === "form-simulate"
            ? "Simulation recorded. No message was sent."
            : "Saved successfully.",
        );
      }
      return body.result;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  async function upload(form: HTMLFormElement) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/real-estate/evidence", {
        method: "POST",
        body: new FormData(form),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await load();
      setMessage(
        "Evidence uploaded privately. Malware scanning is unavailable.",
      );
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="property-workspace">
      <div className="notice">
        Property feed and live delivery are blocked until licensed providers are
        configured. DEMO records and simulated receipts never represent real
        verification or delivery.
      </div>
      <div
        className="filter-bar"
        role="tablist"
        aria-label="Property workspace sections"
      >
        {[
          "properties",
          "imports",
          "partners",
          "forms",
          ...(data?.admin ? ["reviews"] : []),
        ].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={"button " + (tab === t ? "" : "secondary")}
            onClick={() => {
              setTab(t);
              setMessage("");
              setError("");
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {!data ? (
        <p role="status">Loading property workspace…</p>
      ) : (
        <fieldset className="workspace-fields" disabled={busy} aria-busy={busy}>
          {tab === "properties" && (
            <>
              <form
                className="filter-bar property-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(0);
                  setQuery(field(new FormData(e.currentTarget), "q"));
                }}
              >
                <label>
                  Search property address
                  <input name="q" maxLength={100} defaultValue={query} />
                </label>
                <button className="button secondary">Search</button>
              </form>
              {selected && (
                <button className="text-button" onClick={() => setSelected("")}>
                  ← Back to all properties
                </button>
              )}
              <div
                className={
                  selected ? "property-columns" : "property-gallery-layout"
                }
              >
                <section className="panel property-index">
                  <div className="section-heading">
                    <h2>Your properties</h2>
                    <span className="fine">
                      {data.properties.length} records on this page
                    </span>
                  </div>
                  {data.properties.length === 0 && (
                    <p>
                      No properties yet. Import the demo CSV or add an
                      authorized property.
                    </p>
                  )}
                  <div className={selected ? "property-list" : "property-grid"}>
                    {data.properties.map((p) => (
                      <button
                        className={
                          "property-choice " +
                          (p.id === selected ? "selected" : "")
                        }
                        key={p.id}
                        onClick={() => setSelected(p.id)}
                      >
                        {!selected && (
                          <span className="property-card-art">
                            <span className="property-card-tag">
                              {p.is_demo ? "DEMO PROPERTY" : "PROPERTY RECORD"}
                            </span>
                            <NavIcon name="properties" />
                            <span className="property-card-caption">
                              {Number(p.lot_acres).toLocaleString()} ACRES
                            </span>
                          </span>
                        )}
                        <strong>{p.address}</strong>
                        <span>
                          {p.region} · {p.lot_acres} acres ·{" "}
                          {p.is_demo ? "DEMO" : "Evidence required"}
                        </span>
                        <small>{p.listing_status.replaceAll("_", " ")}</small>
                        {!selected && (
                          <>
                            <span className="fine">
                              {p.zoning || "Zoning not supplied"} · Claims
                              require review
                            </span>
                            <strong className="property-price">
                              ${Number(p.asking_price).toLocaleString()}
                            </strong>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="row">
                    <button
                      className="button secondary"
                      disabled={page === 0}
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
                </section>
                {selected && (
                  <div>
                    {data.selectedProperty &&
                    data.selectedProperty.id === selected ? (
                      <PropertyDetail
                        key={selected}
                        property={data.selectedProperty}
                        data={data}
                        run={run}
                        upload={upload}
                      />
                    ) : (
                      <section className="panel">
                        <h2>Build your property workspace</h2>
                        <p>
                          Select a property to manage its facts, evidence,
                          contacts and developer matches.
                        </p>
                        <PropertyEditor run={run} />
                      </section>
                    )}
                  </div>
                )}
              </div>
              <details className="panel">
                <summary>
                  {selected ? "Add another property" : "Add a property"}
                </summary>
                <PropertyEditor run={run} />
              </details>
            </>
          )}
          {tab === "imports" && <PropertyImports data={data} run={run} />}
          {tab === "partners" && <PropertyPartners data={data} run={run} />}
          {tab === "forms" && <PartnerForms data={data} run={run} />}
          {tab === "reviews" && data.admin && (
            <PropertyReview data={data} run={run} />
          )}
        </fieldset>
      )}
    </div>
  );
}
function PropertyImports({
  data,
  run,
}: {
  data: PropertyData;
  run: PropertyRun;
}) {
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<{
      records: Property[];
      total: number;
    } | null>(null),
    [meta, setMeta] = useState<Record<string, unknown> | null>(null),
    [readError, setReadError] = useState("");
  const [historyRows, setHistoryRows] = useState<Record<string, ImportRow[]>>(
    {},
  );
  const [historyError, setHistoryError] = useState("");
  async function loadRows(id: string) {
    setHistoryError("");
    try {
      const r = await fetch("/api/real-estate?import=" + id, {
        cache: "no-store",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setHistoryRows((previous) => ({ ...previous, [id]: body.importRows }));
    } catch (e) {
      setHistoryError((e as Error).message);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Import authorized properties</h2>
        <p>
          Up to 200 records per import. All rows commit together; invalid
          imports roll back property changes. Identical reimports preserve
          reviewed evidence.
        </p>
        <a href="/examples/vacant-lots-demo.csv" download>
          Download 40 fictitious vacant lots (CSV)
        </a>
        <form
          onChange={() => {
            setPreview(null);
            setMeta(null);
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const next = {
              request_key: crypto.randomUUID(),
              source: field(f, "source"),
              license_evidence: field(f, "license_evidence"),
              is_demo: f.has("is_demo"),
              attested: f.has("attested"),
            };
            const result = await run("import-preview", { csv, meta: next });
            if (result) {
              setMeta(next);
              setPreview(result as typeof preview);
            }
          }}
        >
          <label>
            CSV file
            <input
              type="file"
              name="csv"
              accept=".csv,text/csv"
              required
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setReadError("");
                setCsv("");
                setPreview(null);
                if (!file) return;
                if (file.size > 256000) {
                  setReadError("CSV must be at most 256 KB.");
                  return;
                }
                setCsv(await file.text());
              }}
            />
          </label>
          <label>
            Data source
            <input
              name="source"
              required
              minLength={3}
              maxLength={200}
              defaultValue="Fictitious demo CSV"
            />
          </label>
          <label>
            License or authorization evidence
            <textarea
              name="license_evidence"
              required
              minLength={5}
              maxLength={2000}
              defaultValue="Fictitious sample records supplied for Netcozy demonstration only."
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" name="is_demo" defaultChecked />
            These records are fictitious DEMO data
          </label>
          <label className="checkbox">
            <input type="checkbox" name="attested" required />I am authorized to
            import this data and have recorded its source and license
          </label>
          {readError && <p role="alert">{readError}</p>}
          <button className="button" disabled={!csv}>
            Preview import
          </button>
        </form>
        {preview && meta && (
          <section aria-label="Import preview">
            <h3>{preview.total} records ready for review</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Region</th>
                    <th>Acres</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.records.map((p, i) => (
                    <tr key={i}>
                      <td>{p.address}</td>
                      <td>{p.region}</td>
                      <td>{p.lot_acres}</td>
                      <td>{p.asking_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="button"
              onClick={async () => {
                const result = await run("import", { csv, meta });
                if (result) {
                  setPreview(null);
                  setMeta(null);
                }
              }}
            >
              Import reviewed records
            </button>
          </section>
        )}
      </section>
      <section className="panel">
        <h2>Recent import history</h2>
        <p className="fine">
          Latest 20 runs. Load all row dispositions for a run (up to 200).
          Failed runs retain a safe error code.
        </p>
        {historyError && <p role="alert">{historyError}</p>}
        {data.imports.map((r) => (
          <details key={r.id}>
            <summary>
              {r.status} · {r.source} · {r.total_rows} rows
            </summary>
            <p>
              {r.inserted_count} inserted · {r.updated_count} updated ·{" "}
              {r.unchanged_count} unchanged ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </p>
            <p>
              {r.license_evidence} {r.error_code}
            </p>
            <button className="text-button" onClick={() => void loadRows(r.id)}>
              Load row dispositions
            </button>
            <ul>
              {(historyRows[r.id] ?? data.importRows)
                .filter((row) => row.import_id === r.id)
                .map((row) => (
                  <li key={row.id}>
                    CSV row {row.row_number}: {row.disposition}
                  </li>
                ))}
            </ul>
          </details>
        ))}
      </section>
    </>
  );
}
