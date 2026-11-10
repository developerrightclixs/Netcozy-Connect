import Link from "next/link";
import type { WorkspaceData } from "@/features/core/ui-types";
import { Empty } from "./ui";
import { NavIcon } from "./brand";
export function Overview({ data: d }: { data: WorkspaceData }) {
  const pending = d.drafts.filter((x) => !x.reviewed_at).length;
  return (
    <>
      <div className="stats">
        {[
          ["Suggested matches", d.matches.length, "Illustrative demo records"],
          [
            "Active goals",
            d.goals.filter((g) => g.active).length,
            "Your directions of focus",
          ],
          [
            "In your pipeline",
            d.leads.length,
            "Relationships you are tracking",
          ],
          ["Ready to review", pending, "Introductions awaiting your review"],
        ].map(([label, value, hint]) => (
          <article className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <div className="overview-columns">
        <section className="panel overview-matches">
          <div className="section-heading">
            <h2>Top matches for you</h2>
            <Link href="/matches">View all →</Link>
          </div>
          {d.matches.length ? (
            d.matches.slice(0, 4).map((p) => (
              <article className="dashboard-match" key={p.id + p.goal_id}>
                <div className="avatar">
                  {p.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.headline} · {p.region}
                  </small>
                  <span className="badge demo">DEMO</span>
                </div>
                <div className="match-progress">
                  <span>
                    Match <strong>{p.score}%</strong>
                  </span>
                  <progress value={p.score} max={100} />
                </div>
                <Link className="button secondary" href="/matches">
                  View match
                </Link>
              </article>
            ))
          ) : (
            <Empty title="Your next connection starts here">
              <p>
                Complete your goals and enable matching consent to discover
                relevant demo profiles.
              </p>
              <Link className="button" href="/onboarding">
                Complete your profile
              </Link>
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Your next steps</h2>
            <span className="badge">{pending} drafts to review</span>
          </div>
          {[
            [
              !d.profile?.onboarding_complete
                ? "Complete your profile"
                : "Review your goals",
              "Choose your goals and confirm your demo identity status.",
              "/onboarding",
            ],
            [
              "Find a relevant connection",
              "Understand the reasons behind each suggested match.",
              "/matches",
            ],
            [
              "Review your introductions",
              "Add a personal touch before manually using a draft.",
              "/outreach",
            ],
          ].map(([title, hint, href], i) => (
            <Link className="task" href={href} key={href}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong>{title}</strong>
                <small>{hint}</small>
              </div>
              →
            </Link>
          ))}
        </section>
      </div>
      <div className="section-heading">
        <h2>Your workspace</h2>
        <span className="muted">Your goals. Your next opportunity.</span>
      </div>
      <div className="workspace-module-grid">
        {[
          ["onboarding", "Profile & goals", "Build a focused personal profile"],
          ["matches", "Discover matches", "Find people who fit your goals"],
          [
            "properties",
            "Real Estate & Land",
            "Properties, evidence and partner forms",
          ],
          ["pipeline", "My pipeline", "Keep your next steps in one place"],
          [
            "talent",
            "Talent & testers",
            "Opt-in profiles and recruitment opportunities",
          ],
          [
            "marketplace",
            "Yachts & vehicles",
            "Assigned agents and structured inquiries",
          ],
          ["events", "Events & tickets", "Free registration and demo checkout"],
        ].map(([path, title, hint]) => (
          <Link className="module-tile" key={path} href={"/" + path}>
            <span className="module-icon">
              <NavIcon name={path} />
            </span>
            <strong>{title}</strong>
            <small>{hint}</small>
          </Link>
        ))}
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-heading">
            <h2>Your goals</h2>
            <Link href="/onboarding">Manage →</Link>
          </div>
          {d.goals.length ? (
            d.goals.map((g) => (
              <div className="list-row" key={g.id}>
                <div>
                  <strong>{g.title}</strong>
                  <small>
                    {g.industry} · {g.region || "Any region"}
                  </small>
                </div>
                <span className="badge">{g.active ? "Active" : "Paused"}</span>
              </div>
            ))
          ) : (
            <Empty title="Give your connections direction">
              <Link href="/onboarding">Set your first goal →</Link>
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Lead pipeline</h2>
            <Link href="/pipeline">Open pipeline →</Link>
          </div>
          {[
            "SUGGESTED",
            "DRAFTED",
            "SENT",
            "REPLIED",
            "QUALIFIED",
            "CLOSED_WON",
          ].map((stage) => {
            const n = d.leads.filter((l) => l.stage === stage).length;
            return (
              <div className="pipeline-summary" key={stage}>
                <span>{stage.replaceAll("_", " ").toLowerCase()}</span>
                <progress value={n} max={Math.max(1, d.leads.length)} />
                <strong>{n}</strong>
              </div>
            );
          })}
        </section>
      </div>
      <div className="notice">
        Demo directory: all example people and scores are fictitious. No real
        outreach or identity verification has taken place.
      </div>
    </>
  );
}
