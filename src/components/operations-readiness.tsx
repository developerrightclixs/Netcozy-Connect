"use client";
import { useState } from "react";
type Readiness = {
  checkedAt: string;
  checks: { name: string; status: string }[];
  deployment: {
    configuredOrigin: boolean;
    httpsOrigin: boolean;
    schemaCheck: string;
  };
  remaining: string[];
};
export function OperationsReadiness() {
  const [data, setData] = useState<Readiness | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>Operational readiness</h2>
      <p className="muted">
        Run a read-only check of application table access. This does not certify
        production readiness.
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void fetch("/api/operations", { cache: "no-store" })
            .then(async (r) => {
              const b = await r.json();
              if (!r.ok) throw new Error(b.error);
              setData(b);
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Checking…" : "Check deployment readiness"}
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>Checked {new Date(data.checkedAt).toLocaleString()}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Application area</th>
                  <th>Read access</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name.replaceAll("_", " ")}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{data.deployment.schemaCheck}</p>
          <p>
            Application origin:{" "}
            {data.deployment.configuredOrigin ? "Configured" : "Pending"} ·
            HTTPS origin:{" "}
            {data.deployment.httpsOrigin ? "Configured" : "Pending"}
          </p>
          <h3>Launch verification still required</h3>
          <ul>
            {data.remaining.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
