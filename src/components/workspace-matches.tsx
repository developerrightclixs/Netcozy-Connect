import Link from "next/link";
import { useState } from "react";
import { industries } from "@/features/core/domain";
import type {
  WorkspaceData,
  Run,
  Match,
  Filters,
} from "@/features/core/ui-types";
import { field, Select, Empty } from "./ui";
function MatchCard({
  match: m,
  data: d,
  run,
}: {
  match: Match;
  data: WorkspaceData;
  run: Run;
}) {
  const feedback = d.feedback.find(
    (f) => f.goal_id === m.goal_id && f.directory_id === m.id,
  );
  return (
    <article className="match-card">
      <div className="match-card-top">
        <div className="avatar large">
          {m.name
            .split(" ")
            .slice(0, 2)
            .map((x) => x[0])
            .join("")}
        </div>
        <div className="score">
          {m.score}
          <small>FIT SCORE</small>
        </div>
      </div>
      <span className="badge demo">FICTITIOUS DEMO</span>
      <h3>{m.name}</h3>
      <p>{m.headline}</p>
      <small>
        {m.region} · {m.industry}
      </small>
      <div className="match-goal">For: {m.goal_title}</div>
      <ul className="reasons">
        {m.reasons.map((r) => (
          <li key={r}>✓ {r}</li>
        ))}
      </ul>
      <div className="card-actions">
        <button
          className="button secondary"
          onClick={() =>
            void run("feedback", {
              goal_id: m.goal_id,
              directory_id: m.id,
              status: "SAVED",
            })
          }
        >
          {feedback?.status === "SAVED" ? "Saved ✓" : "Save match"}
        </button>
        <button
          className="text-button"
          onClick={() =>
            void run("feedback", {
              goal_id: m.goal_id,
              directory_id: m.id,
              status: "DISMISSED",
            })
          }
        >
          Dismiss
        </button>
      </div>
      <Link
        className="text-link"
        href={"/outreach?goal=" + m.goal_id + "&person=" + m.id}
      >
        Prepare introduction ↗
      </Link>
    </article>
  );
}
export function Matches({ data: d, run }: { data: WorkspaceData; run: Run }) {
  const [filters, setFilters] = useState<Filters>({
    industry: "",
    region: "",
    saved: false,
  });
  const matches = d.matches.filter(
    (m) =>
      (!filters.industry || m.industry === filters.industry) &&
      m.region.toLowerCase().includes(filters.region.toLowerCase()) &&
      d.feedback.find((f) => f.goal_id === m.goal_id && f.directory_id === m.id)
        ?.status !== "DISMISSED" &&
      (!filters.saved ||
        d.feedback.some(
          (f) =>
            f.goal_id === m.goal_id &&
            f.directory_id === m.id &&
            f.status === "SAVED",
        )),
  );
  return (
    <>
      <div className="notice">
        Illustrative demo scores. Industry and complementary intent determine
        eligibility; region, skills and availability explain ranking. Recomputed
        from your current goals whenever you open or refresh the workspace.
      </div>
      <section className="panel filter-bar">
        <label>
          Industry
          <select
            value={filters.industry}
            onChange={(e) =>
              setFilters({ ...filters, industry: e.target.value })
            }
          >
            <option value="">All industries</option>
            {industries.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        <label>
          Region
          <input
            value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value })}
            placeholder="Filter region"
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.saved}
            onChange={(e) =>
              setFilters({ ...filters, saved: e.target.checked })
            }
          />
          Saved only
        </label>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run("search", {
              label: field(new FormData(e.currentTarget), "label"),
              filters,
            });
          }}
        >
          <label>
            Search name
            <input
              name="label"
              placeholder="Name this search"
              required
              maxLength={100}
            />
          </label>
          <button className="button secondary">Save search</button>
        </form>
      </section>
      {d.searches.length > 0 && (
        <div className="saved-searches">
          Saved searches:{" "}
          {d.searches.map((s) => (
            <button
              className="chip"
              key={s.id}
              onClick={() => setFilters(s.filters)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="section-heading">
        <h2>{matches.length} relevant matches</h2>
        <span className="muted">Highest fit first</span>
      </div>
      {matches.length ? (
        <div className="match-grid">
          {matches.map((m) => (
            <MatchCard key={m.id + m.goal_id} match={m} data={d} run={run} />
          ))}
        </div>
      ) : (
        <Empty title="No matches for these filters">
          Check your active goal’s industry and target intent, matching consent,
          or try another region.
        </Empty>
      )}
    </>
  );
}
export function Outreach({ data: d, run }: { data: WorkspaceData; run: Run }) {
  const [copied, setCopied] = useState("");
  const initial =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search);
  return (
    <>
      <div className="notice">
        Draft assistance only. Nothing is sent automatically. Demo people have
        no external profiles or real contact details. Copying a demo draft does
        not send a message.
      </div>
      <section className="panel">
        <h2>A thoughtful first introduction</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const pair = field(f, "match").split("|");
            void run("draft", {
              goal_id: pair[0],
              directory_id: pair[1],
              template_id: field(f, "template_id"),
            });
          }}
        >
          <div className="form-grid">
            <label>
              Relevant match
              <select
                name="match"
                required
                defaultValue={
                  initial?.get("goal") + "|" + initial?.get("person")
                }
              >
                {d.matches.map((m) => (
                  <option key={m.id + m.goal_id} value={m.goal_id + "|" + m.id}>
                    {m.name} — {m.goal_title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Approved template
              <select name="template_id" required>
                {d.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · v{t.version}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="button"
            disabled={!d.matches.length || !d.templates.length}
          >
            Prepare draft →
          </button>
        </form>
      </section>
      {!d.drafts.length && (
        <Empty title="Give your introduction a personal touch">
          Choose a relevant match and an approved template to start.
        </Empty>
      )}
      {d.drafts.map((draft) => (
        <article className="panel" key={draft.id}>
          <div className="section-heading">
            <div>
              <h2>
                {d.directory.find((p) => p.id === draft.directory_id)?.name ??
                  "Demo connection"}
              </h2>
              <small>
                {d.goals.find((g) => g.id === draft.goal_id)?.title}
              </small>
            </div>
            <span className="badge">
              {draft.reviewed_at ? "Reviewed" : "Needs review"}
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("draft-edit", {
                id: draft.id,
                body: field(new FormData(e.currentTarget), "body"),
              });
            }}
          >
            <label>
              Your message
              <textarea
                aria-label="Your message"
                key={draft.body}
                name="body"
                defaultValue={draft.body}
                required
                minLength={10}
                maxLength={3000}
                rows={5}
              />
            </label>
            <p className="fine">
              Save edits first. Changing the message clears its review status.
            </p>
            <button className="button secondary">Save edits</button>
          </form>
          <div className="card-actions">
            <button
              className="button"
              onClick={() => void run("draft-review", { id: draft.id })}
            >
              I reviewed this saved draft
            </button>
            <button
              className="button secondary"
              disabled={!draft.reviewed_at}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(draft.body);
                  setCopied(draft.id);
                } catch {
                  setCopied("failed");
                }
              }}
            >
              {copied === draft.id ? "Copied ✓" : "Copy reviewed message"}
            </button>
          </div>
          {copied === "failed" && (
            <p role="alert">
              Clipboard unavailable. Select the text to copy it manually.
            </p>
          )}
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run("lead", {
                goal_id: draft.goal_id,
                directory_id: draft.directory_id,
                draft_id: draft.id,
                pipeline: field(new FormData(e.currentTarget), "pipeline"),
              });
            }}
          >
            <Select
              name="pipeline"
              label="Track in pipeline"
              options={["PERSONAL", "B2B", "RECRUITMENT"]}
            />
            <button
              className="button secondary"
              disabled={d.leads.some(
                (l) =>
                  l.goal_id === draft.goal_id &&
                  l.directory_id === draft.directory_id,
              )}
            >
              Add to pipeline
            </button>
          </form>
        </article>
      ))}
    </>
  );
}
