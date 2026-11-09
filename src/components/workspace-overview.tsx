import Link from "next/link";
import type { WorkspaceData } from "@/features/core/ui-types";
import { Empty } from "./ui";
export function Overview({ data: d }: { data: WorkspaceData }) {
  return (
    <>
      <div className="overview-banner">
        <div>
          <span className="pill">YOUR NEXT CHAPTER</span>
          <h2>
            Good connections start
            <br />
            with a clear goal.
          </h2>
          <p>Tell us where you want to go. We’ll help you find the fit.</p>
          <Link
            className="button"
            href={d.profile?.onboarding_complete ? "/matches" : "/onboarding"}
          >
            {d.profile?.onboarding_complete
              ? "Discover your matches"
              : "Complete your profile"}{" "}
            →
          </Link>
        </div>
        <div className="banner-mark" aria-hidden="true">
          ✧
        </div>
      </div>
      <div className="stats">
        {[
          [
            "Active goals",
            d.goals.filter((g) => g.active).length,
            "Your directions of focus",
          ],
          ["Suggested matches", d.matches.length, "Illustrative demo records"],
          [
            "In your pipeline",
            d.leads.length,
            "Relationships you are tracking",
          ],
          [
            "Ready to review",
            d.drafts.filter((x) => !x.reviewed_at).length,
            "Your personal introductions",
          ],
        ].map(([label, value, hint]) => (
          <article className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
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
            <h2>Suggested next steps</h2>
            <span>✧</span>
          </div>
          <Link className="task" href="/onboarding">
            <span>01</span>
            <div>
              <strong>Make your profile yours</strong>
              <small>Review your goals and demo identity status</small>
            </div>
            →
          </Link>
          <Link className="task" href="/matches">
            <span>02</span>
            <div>
              <strong>Find a relevant connection</strong>
              <small>Understand the reasons behind the match</small>
            </div>
            →
          </Link>
          <Link className="task" href="/outreach">
            <span>03</span>
            <div>
              <strong>Add your personal touch</strong>
              <small>Review an introduction before using it</small>
            </div>
            →
          </Link>
        </section>
      </div>
      <div className="notice">
        Demo directory: all example people and scores are fictitious. No real
        outreach or identity verification has taken place.
      </div>
    </>
  );
}
