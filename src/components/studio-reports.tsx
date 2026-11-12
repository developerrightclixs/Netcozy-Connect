"use client";
import type { StudioData } from "@/features/studio/domain";
import { studioProviders } from "@/integrations/media-ai/provider";
import { Empty, field } from "./ui";
type Run = (action: string, data: unknown) => Promise<unknown>;
export function Reports({ data, run }: { data: StudioData; run: Run }) {
  const exported = data.creatives.filter((c) =>
    data.exports.some((e) => e.creative_id === c.id),
  );
  return (
    <>
      <div className="studio-stats">
        <section className="panel">
          <p>Recent demo preparations</p>
          <h2>{data.usage.length}</h2>
          <small>Template operations; up to 100 shown</small>
        </section>
        <section className="panel">
          <p>Provider API calls</p>
          <h2>0</h2>
          <small>Live providers are blocked</small>
        </section>
        <section className="panel">
          <p>Billing & estimates</p>
          <h2>Not configured</h2>
          <small>No live rates, charges or subscription claimed</small>
        </section>
      </div>
      <section className="panel">
        <h2>Provider readiness</h2>
        {Object.entries(studioProviders).map(([key, p]) => (
          <div className="studio-provider" key={key}>
            <strong>{p.capability}</strong>
            <span className="pill">{p.status}</span>
            <p className="muted">{p.reason}</p>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Manually reported results</h2>
        <p className="muted">
          Record aggregate results from your authorized source after manual
          publication. Entries are immutable, unverified snapshots for a stated
          period; they are not summed because periods may overlap. Do not enter
          personal data.
        </p>
        {!!exported.length && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const c = exported.find((c) => c.id === field(f, "id"))!;
              void run("metrics", {
                id: c.id,
                revision: c.revision,
                request_key: crypto.randomUUID(),
                period_start: field(f, "period_start"),
                period_end: field(f, "period_end"),
                views: Number(field(f, "views")),
                clicks: Number(field(f, "clicks")),
                replies: Number(field(f, "replies")),
                conversions: Number(field(f, "conversions")),
                evidence: field(f, "evidence"),
                acknowledge: f.get("acknowledge") === "on",
              });
            }}
          >
            <label>
              Exported creative
              <select name="id">
                {exported.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Period start
                <input type="date" name="period_start" required />
              </label>
              <label>
                Period end
                <input
                  type="date"
                  name="period_end"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </div>
            <div className="form-grid">
              {["views", "clicks", "replies", "conversions"].map((k) => (
                <label key={k}>
                  {k}
                  <input
                    name={k}
                    type="number"
                    required
                    min={0}
                    max={1000000000}
                    defaultValue={0}
                  />
                </label>
              ))}
            </div>
            <label>
              Aggregate source / evidence note
              <input name="evidence" required minLength={5} maxLength={500} />
            </label>
            <label className="check">
              <input name="acknowledge" type="checkbox" required />
              These are manually reported aggregate results from a source I am
              authorized to use.
            </label>
            <button className="button">Record manual results</button>
          </form>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Creative / period</th>
                <th>Views</th>
                <th>Clicks</th>
                <th>Replies</th>
                <th>Conversions</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m) => (
                <tr key={m.id}>
                  <td>
                    {data.creatives.find((c) => c.id === m.creative_id)
                      ?.title ?? m.creative_id}
                    <br />
                    {m.period_start} – {m.period_end}
                  </td>
                  <td>{m.views}</td>
                  <td>{m.clicks}</td>
                  <td>{m.replies}</td>
                  <td>{m.conversions}</td>
                  <td>
                    Manual / unverified
                    <br />
                    {m.evidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.metrics.length && (
          <Empty title="No reported results">
            Export an approved creative, publish manually and record your
            aggregate results here.
          </Empty>
        )}
      </section>
    </>
  );
}
