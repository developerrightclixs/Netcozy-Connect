import { roles } from "@/features/core/domain";
import type { WorkspaceData, Run } from "@/features/core/ui-types";
import { field, Select, Empty, AuditTable } from "./ui";
import { OperationsReadiness } from "./operations-readiness";
export function Admin({ data: d, run }: { data: WorkspaceData; run: Run }) {
  if (!d.admin)
    return (
      <Empty title="Administrator access required">
        This account does not have access to administration.
      </Empty>
    );
  const a = d.admin;
  function exportCsv() {
    const rows = [
      ["actor", "action", "entity", "record", "time"],
      ...a.audit.map((x) => [
        x.actor_id,
        x.action,
        x.entity,
        x.entity_id,
        x.created_at,
      ]),
    ];
    const safe = (s: string) =>
      '"' + (/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
    const blob = new Blob([rows.map((r) => r.map(safe).join(",")).join("\n")], {
      type: "text/csv",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "netcozy-audit.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <>
      <OperationsReadiness />
      <div className="stats">
        {[
          ["Profiles (first 200)", a.users.length],
          ["Identity demos (first 200)", a.checks.length],
          ["Privacy requests (first 200)", a.requests.length],
          ["Template versions", a.templates.length],
        ].map(([label, n]) => (
          <article className="stat" key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Members & roles</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Region</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {a.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name || "New member"}</td>
                  <td>{u.region || "Not provided"}</td>
                  <td>
                    {a.roles
                      .filter((r) => r.user_id === u.id)
                      .map((r) => r.role)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.roles.includes("SUPER_ADMIN") && (
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("role", {
                user_id: field(f, "user_id"),
                role: field(f, "role"),
                remove: f.get("remove") === "on",
              });
            }}
          >
            <label>
              Member
              <select name="user_id">
                {a.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.id}
                  </option>
                ))}
              </select>
            </label>
            <Select
              name="role"
              label="Role"
              options={roles.filter((x) => x !== "SUPER_ADMIN")}
            />
            <label className="check">
              <input name="remove" type="checkbox" />
              Remove selected role
            </label>
            <button className="button secondary">Apply role change</button>
          </form>
        )}
      </section>
      <section className="panel">
        <h2>Identity review</h2>
        <p className="muted">
          Real verification provider: BLOCKED. Demo results cannot be approved
          as real identity checks.
        </p>
        {a.checks.map((c) => (
          <div className="list-row" key={c.id}>
            <strong>
              {a.users.find((u) => u.id === c.owner_id)?.display_name ||
                "Member"}
            </strong>
            <span className="badge demo">
              {c.provider} · {c.status}
            </span>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Versioned outreach templates</h2>
        <p className="muted">
          Versions are immutable. Publish a new version to change or approve
          content. Allowed merge fields: {"{{name}}, {{industry}}, {{goal}}"}.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run("template", {
              template_key: field(f, "template_key"),
              version: Number(field(f, "version")),
              title: field(f, "title"),
              body: field(f, "body"),
              approved: f.get("approved") === "on",
            });
          }}
        >
          <div className="form-grid">
            <label>
              Template key
              <input
                name="template_key"
                required
                pattern="[a-z0-9-]+"
                maxLength={100}
                placeholder="introduction"
              />
            </label>
            <label>
              New version
              <input
                name="version"
                type="number"
                min={1}
                defaultValue={2}
                required
              />
            </label>
          </div>
          <label>
            Title
            <input name="title" maxLength={100} required />
          </label>
          <label>
            Body
            <textarea
              name="body"
              rows={4}
              required
              minLength={10}
              maxLength={3000}
            />
          </label>
          <label className="check">
            <input name="approved" type="checkbox" />
            Approve this version for manual-social drafts
          </label>
          <button className="button">Create template version</button>
        </form>
        <details>
          <summary>Preview version history</summary>
          {a.templates.map((t) => (
            <article className="template-preview" key={t.id}>
              <strong>
                {t.title} · v{t.version} ·{" "}
                {t.approved ? "Approved" : "Unapproved"}
              </strong>
              <p>{t.body}</p>
            </article>
          ))}
        </details>
      </section>
      <section className="panel">
        <h2>Matching weights</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(
              "weights",
              Object.fromEntries(
                Object.keys(a.weights).map((k) => [k, Number(field(f, k))]),
              ),
            );
          }}
        >
          <div className="form-grid">
            {Object.entries(a.weights).map(([key, value]) => (
              <label key={key}>
                {key}
                <input
                  name={key}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={value}
                  required
                />
              </label>
            ))}
          </div>
          <button className="button secondary">Save scoring weights</button>
        </form>
      </section>
      <section className="panel">
        <h2>Privacy request queue</h2>
        <p className="muted">
          Mark fulfilled only after the request has been handled through your
          approved operational process.
        </p>
        {a.requests.map((p) => (
          <form
            className="inline-form list-row"
            key={p.id}
            onSubmit={(e) => {
              e.preventDefault();
              void run("privacy-status", {
                id: p.id,
                status: field(new FormData(e.currentTarget), "status"),
              });
            }}
          >
            <strong>
              {a.users.find((u) => u.id === p.owner_id)?.display_name ||
                "Member"}{" "}
              · {p.kind}
            </strong>
            <Select
              name="status"
              label="Request status"
              options={["PENDING", "IN_REVIEW", "FULFILLED"]}
              defaultValue={p.status}
            />
            <button className="button secondary">Update</button>
          </form>
        ))}
      </section>
      <section className="panel">
        <h2>Integration status</h2>
        <p>
          Supabase: configured · Identity: DEMO · LinkedIn import: BLOCKED ·
          Social/SMS/WhatsApp sending: unavailable.
        </p>
        <p className="muted">
          Provider health reflects the current successful API request, not an
          independent uptime monitor.
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Audit history (latest 200)</h2>
          <button className="button secondary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <AuditTable events={a.audit} />
      </section>
    </>
  );
}
