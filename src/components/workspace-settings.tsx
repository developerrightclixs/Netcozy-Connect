import { useState } from "react";
import { stages, latestConsent } from "@/features/core/domain";
import type { WorkspaceData, Run } from "@/features/core/ui-types";
import { field, Select, Empty, AuditTable } from "./ui";
export function Pipeline({ data: d, run }: { data: WorkspaceData; run: Run }) {
  const [pipeline, setPipeline] = useState("ALL"),
    [view, setView] = useState("board");
  const leads = d.leads.filter(
    (l) => pipeline === "ALL" || l.pipeline === pipeline,
  );
  const card = (lead: WorkspaceData["leads"][number]) => (
    <article key={lead.id} className="lead-card">
      <span className="badge demo">DEMO · {lead.pipeline}</span>
      <h3>
        {d.directory.find((p) => p.id === lead.directory_id)?.name ??
          "Demo connection"}
      </h3>
      <p className="muted">
        {d.goals.find((g) => g.id === lead.goal_id)?.title}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run("stage", {
            id: lead.id,
            stage: field(f, "stage"),
            notes: field(f, "notes"),
            manual_attestation: f.get("manual_attestation") === "on",
          });
        }}
      >
        <Select
          name="stage"
          label="Stage"
          options={stages}
          defaultValue={lead.stage}
        />
        <label>
          Notes
          <textarea
            rows={2}
            name="notes"
            defaultValue={lead.notes}
            maxLength={3000}
          />
        </label>
        <label className="check">
          <input name="manual_attestation" type="checkbox" />I am manually
          recording a simulated outcome. Nothing is sent.
        </label>
        <button className="button secondary full">Update stage</button>
      </form>
    </article>
  );
  return (
    <>
      <div className="section-heading">
        <div className="tabs">
          {["ALL", "PERSONAL", "B2B", "RECRUITMENT"].map((p) => (
            <button
              key={p}
              className={pipeline === p ? "selected" : ""}
              onClick={() => setPipeline(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          className="button secondary"
          onClick={() => setView(view === "board" ? "table" : "board")}
        >
          {view === "board" ? "Table view" : "Board view"}
        </button>
      </div>
      <div className="notice">
        Advanced stages require matching consent and a reviewed draft in the
        backend and database. All outcomes here refer to fictitious demo
        records.
      </div>
      {!leads.length ? (
        <Empty title="Keep your connections moving">
          Add a reviewed introduction from Outreach drafts to start your
          pipeline.
        </Empty>
      ) : view === "board" ? (
        <div className="kanban">
          {stages.map((stage) => (
            <section className="kanban-column" key={stage}>
              <h2>
                {stage.replaceAll("_", " ")}{" "}
                <span>{leads.filter((l) => l.stage === stage).length}</span>
              </h2>
              {leads.filter((l) => l.stage === stage).map(card)}
            </section>
          ))}
        </div>
      ) : (
        <div className="lead-table">{leads.map(card)}</div>
      )}
    </>
  );
}
export function Settings({ data: d, run }: { data: WorkspaceData; run: Run }) {
  return (
    <>
      <section className="panel">
        <h2>Your choices, clearly recorded</h2>
        <p className="muted">
          Withdraw consent at any time. Changes append a new record; earlier
          evidence is retained. Channel preferences do not enable messaging
          services.
        </p>
        {[
          {
            purpose: "matching",
            channel: "platform",
            label: "Platform matching",
          },
          {
            purpose: "contact-sharing",
            channel: "platform",
            label: "Contact sharing (no contacts disclosed in demo)",
          },
          { purpose: "marketing", channel: "email", label: "Marketing email" },
          {
            purpose: "marketing",
            channel: "sms",
            label: "SMS (provider blocked)",
          },
          {
            purpose: "marketing",
            channel: "whatsapp",
            label: "WhatsApp (provider blocked)",
          },
        ].map((x) => {
          const granted = latestConsent(d.consents, x.purpose, x.channel);
          return (
            <div className="list-row" key={x.channel + x.purpose}>
              <div>
                <strong>{x.label}</strong>
                <small>
                  Policy 2026-11-v1 · {granted ? "Opted in" : "Not opted in"}
                </small>
              </div>
              <button
                className={"button " + (granted ? "secondary" : "")}
                onClick={() =>
                  void run("consent", {
                    purpose: x.purpose,
                    channel: x.channel,
                    granted: !granted,
                  })
                }
              >
                {granted ? "Withdraw" : "Opt in"}
              </button>
            </div>
          );
        })}
      </section>
      <section className="panel">
        <h2>Consent history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Purpose / channel</th>
                <th>Choice</th>
                <th>Policy</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {d.consents.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.purpose} / {c.channel}
                  </td>
                  <td>{c.granted ? "Granted" : "Withdrawn"}</td>
                  <td>{c.policy_version}</td>
                  <td>{new Date(c.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Account data requests</h2>
        <p className="muted">
          Submit a request for administrator review. A request does not
          automatically export or delete your account.
        </p>
        <div className="row">
          <button
            className="button secondary"
            onClick={() => void run("privacy", { kind: "EXPORT" })}
          >
            Request data export
          </button>
          <button
            className="button danger"
            onClick={() => void run("privacy", { kind: "DELETE" })}
          >
            Request account deletion
          </button>
        </div>
        {d.privacy.map((p) => (
          <div className="list-row" key={p.id}>
            <strong>{p.kind}</strong>
            <span className="badge">{p.status}</span>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Your activity</h2>
        <AuditTable events={d.audit} />
      </section>
    </>
  );
}
