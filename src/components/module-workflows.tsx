"use client";
import { useState } from "react";
import type { ModuleData } from "@/features/modules/domain";
import { rankCandidates, formatPrice } from "@/features/modules/domain";
import type { ModuleRun } from "./module-workspace";
import { Facts } from "./module-workspace";
import { field } from "./ui";
export function TalentProfile({
  data,
  run,
}: {
  data: ModuleData;
  run: ModuleRun;
}) {
  const c = data.candidate;
  return (
    <section className="panel">
      <h2>Your opt-in talent profile</h2>
      <p>
        Share only information you want recruiters to see. Publication requires
        current platform matching consent and your explicit choice below. No
        third-party acquisition, scraping, resume upload or ID photos.
      </p>
      {!data.matchingConsent && (
        <p className="notice">
          Enable platform matching in Privacy & settings before publishing your
          talent profile.
        </p>
      )}
      <form
        key={c?.revision ?? 0}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run("candidate-save", {
            name: field(f, "name"),
            headline: field(f, "headline"),
            region: field(f, "region"),
            skills: field(f, "skills")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            kind: field(f, "kind"),
            remote: f.has("remote"),
            available: f.has("available"),
            bio: field(f, "bio"),
            discoverable: f.has("discoverable"),
            is_demo: c?.is_demo ?? f.has("is_demo"),
            attested: f.has("attested"),
          });
        }}
      >
        <div className="form-grid">
          <label>
            Talent display name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={c?.name}
            />
          </label>
          <label>
            Talent headline
            <input
              name="headline"
              required
              minLength={3}
              maxLength={180}
              defaultValue={c?.headline}
            />
          </label>
          <label>
            Talent region
            <input
              name="region"
              required
              minLength={2}
              maxLength={100}
              defaultValue={c?.region}
            />
          </label>
          <label>
            Talent skills (comma separated)
            <input
              name="skills"
              required
              maxLength={1000}
              defaultValue={c?.skills.join(", ")}
            />
          </label>
        </div>
        <label>
          Opportunity preference
          <select
            name="kind"
            aria-label="Opportunity preference"
            defaultValue={c?.kind ?? "TESTER"}
          >
            {["JOB", "TESTER", "COMMISSION"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Talent introduction
          <textarea
            name="bio"
            aria-label="Talent introduction"
            maxLength={1500}
            defaultValue={c?.bio}
          />
        </label>
        <label className="checkbox">
          <input name="remote" type="checkbox" defaultChecked={c?.remote} />
          Available for remote work
        </label>
        <label className="checkbox">
          <input
            name="available"
            type="checkbox"
            defaultChecked={c?.available ?? true}
          />
          Currently available
        </label>
        {!c && (
          <label className="checkbox">
            <input name="is_demo" type="checkbox" defaultChecked />
            Fictitious DEMO profile
          </label>
        )}
        <label className="checkbox">
          <input
            name="discoverable"
            type="checkbox"
            defaultChecked={c?.discoverable}
          />
          Publish my talent profile for matching
        </label>
        <label className="checkbox">
          <input name="attested" type="checkbox" />I consent to make these
          supplied profile fields discoverable to matching users
        </label>
        <p className="fine">
          To withdraw publication, uncheck “Publish my talent profile” and save.
          Existing private application records are retained. Real identity
          verification is unavailable.
        </p>
        <button className="button">Save talent profile</button>
      </form>
    </section>
  );
}
export function TalentMatches({ data }: { data: ModuleData }) {
  const jobs = data.owned.filter((l) => l.module === "TALENT");
  const [jobId, setJobId] = useState("");
  const job = jobs.find((l) => l.id === jobId) ?? jobs[0];
  const ranked = job
    ? rankCandidates(job, data.candidates, data.matchingConsent)
    : [];
  return (
    <section className="panel">
      <h2>Relevant talent</h2>
      <p>
        Preview matches for your recruitment opportunities. Scores use exact
        skills, opportunity preference, region/remote preferences and demo mode.
        Profile opt-in, availability and current matching consent are required.
        No contact details or external outreach are provided.
      </p>
      <label>
        Match opportunity
        <select
          aria-label="Match opportunity"
          value={job?.id ?? ""}
          onChange={(e) => setJobId(e.target.value)}
        >
          <option value="">Select an owned opportunity</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} ({j.status})
            </option>
          ))}
        </select>
      </label>
      {!data.matchingConsent ? (
        <p>Enable matching consent in Privacy & settings.</p>
      ) : !ranked.length ? (
        <p>No eligible candidate profiles match this opportunity yet.</p>
      ) : (
        ranked.map((c) => (
          <article className="claim-row" key={c.id}>
            <h3>
              {c.name} · {c.score}% fit
            </h3>
            <span className={"badge " + (c.is_demo ? "demo" : "")}>
              {c.is_demo
                ? "DEMO · FICTITIOUS"
                : "SELF-SUPPLIED · IDENTITY UNVERIFIED"}
            </span>
            <p>
              {c.headline} · {c.region}
            </p>
            <p>{c.reasons.join(" · ")}</p>
            <p>{c.bio}</p>
          </article>
        ))
      )}
    </section>
  );
}
export function ModuleInbox({
  data,
  run,
}: {
  data: ModuleData;
  run: ModuleRun;
}) {
  const names = new Map(
    [...data.listings, ...data.owned, ...data.assignments].map((l) => [
      l.id,
      l.title,
    ]),
  );
  return (
    <>
      <section className="panel">
        <h2>Recruitment applications</h2>
        <p className="fine">
          Latest 100 accessible applications. Shortlisting requires current
          candidate consent and the published listing revision. Withdrawal and
          decline remain available for cleanup.
        </p>
        {!data.applications.length && <p>No applications yet.</p>}
        {data.applications.map((a) => (
          <article className="claim-row" key={a.id}>
            <h3>
              {a.listing_snapshot.title}{" "}
              <span className="badge">{a.status}</span>
            </h3>
            <p>
              <strong>{a.profile_snapshot.name}</strong> ·{" "}
              {a.profile_snapshot.headline}
            </p>
            <p className="fine">
              Submitted profile: {a.profile_snapshot.region} ·{" "}
              {a.profile_snapshot.skills.join(", ")} ·{" "}
              {a.profile_snapshot.is_demo
                ? "DEMO · Fictitious"
                : "Self-supplied · Identity unverified"}
            </p>
            <p>{a.message}</p>
            <p className="fine">
              Listing revision {a.listing_revision} ·{" "}
              {new Date(a.created_at).toLocaleString()}
            </p>
            {["APPLIED", "SHORTLISTED"].includes(a.status) && (
              <div className="row">
                {a.applicant_id === data.userId && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      void run("application-action", {
                        id: a.id,
                        status: "WITHDRAWN",
                      })
                    }
                  >
                    Withdraw application
                  </button>
                )}
                {a.recruiter_id === data.userId && (
                  <>
                    <button
                      className="button"
                      onClick={() =>
                        void run("application-action", {
                          id: a.id,
                          status: "SHORTLISTED",
                        })
                      }
                    >
                      Shortlist application
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        void run("application-action", {
                          id: a.id,
                          status: "DECLINED",
                        })
                      }
                    >
                      Decline application
                    </button>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Marketplace inquiries</h2>
        <p>
          Private in-app requests. Acceptance records mutual interest; it does
          not send a message or unlock an external contact.
        </p>
        {!data.inquiries.length && <p>No inquiries yet.</p>}
        {data.inquiries.map((r) => (
          <article className="claim-row" key={r.id}>
            <h3>
              {names.get(r.listing_id) ?? "Marketplace listing"}{" "}
              <span className="badge">{r.status}</span>
            </h3>
            <p>{r.message}</p>
            <p className="fine">
              Revision {r.listing_revision} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </p>
            {r.status === "REQUESTED" && (
              <div className="row">
                {r.sender_id === data.userId ? (
                  <button
                    className="button secondary"
                    onClick={() =>
                      void run("inquiry-action", {
                        id: r.id,
                        status: "WITHDRAWN",
                      })
                    }
                  >
                    Withdraw inquiry
                  </button>
                ) : (
                  (r.owner_id === data.userId ||
                    r.agent_id === data.userId) && (
                    <>
                      <button
                        className="button"
                        onClick={() =>
                          void run("inquiry-action", {
                            id: r.id,
                            status: "ACCEPTED",
                          })
                        }
                      >
                        Accept inquiry
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          void run("inquiry-action", {
                            id: r.id,
                            status: "DECLINED",
                          })
                        }
                      >
                        Decline inquiry
                      </button>
                    </>
                  )
                )}
              </div>
            )}
          </article>
        ))}
      </section>
      <ModuleHistory data={data} />
    </>
  );
}
export function EventTickets({
  data,
  run,
}: {
  data: ModuleData;
  run: ModuleRun;
}) {
  const mine = data.orders.filter((o) => o.buyer_id === data.userId);
  const organized = data.owned.filter((l) => l.module === "EVENT");
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>Your registrations & tickets</h2>
          <button className="button secondary" onClick={() => window.print()}>
            Print tickets
          </button>
        </div>
        <p>
          Only FREE registrations and DEMO simulations are issued. DEMO
          references provide no real admission. No payment or refund is
          processed.
        </p>
        {!mine.length && (
          <p>No registrations yet. Open an event to register.</p>
        )}
        {mine.map((o) => (
          <article className="claim-row" key={o.id}>
            <h3>
              {o.event_snapshot.title}{" "}
              <span className="badge">
                {o.mode} · {o.status}
              </span>
            </h3>
            <p>
              {o.quantity} ticket(s) · {formatPrice(o.total_minor, o.currency)}
              {o.mode === "DEMO"
                ? " simulated total · No charge"
                : " · Free registration"}
            </p>
            <p>
              {String(o.event_snapshot.facts.venue)} ·{" "}
              {new Date(
                String(o.event_snapshot.facts.starts_at),
              ).toLocaleString()}
            </p>
            {data.tickets
              .filter((t) => t.order_id === o.id)
              .map((t) => (
                <div className="event-ticket" key={t.id}>
                  <strong>
                    {o.mode === "DEMO"
                      ? "DEMO TICKET · NO REAL ADMISSION"
                      : "FREE EVENT TICKET"}
                  </strong>
                  <code>{t.reference}</code>
                  <span>{t.status.replaceAll("_", " ")}</span>
                </div>
              ))}
            {o.status === "CONFIRMED" && (
              <button
                className="button secondary"
                onClick={() => void run("cancel-order", { id: o.id })}
              >
                Cancel registration
              </button>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Organizer check-in</h2>
        <p>
          Only your own event’s unused valid tickets can be checked in once.
          Real-event check-in opens two hours before the start; DEMO tickets may
          be tested earlier.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run("checkin", {
              listing_id: field(f, "listing_id"),
              reference: field(f, "reference"),
            });
          }}
        >
          <label>
            Check-in event
            <select name="listing_id" aria-label="Check-in event" required>
              <option value="">Select your event</option>
              {organized.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ticket reference
            <input
              name="reference"
              required
              pattern="[a-f0-9]{32}"
              maxLength={32}
              autoComplete="off"
            />
          </label>
          <button className="button">Check in ticket</button>
        </form>
      </section>
      <section className="panel">
        <h2>Organizer registrations</h2>
        <p className="fine">
          Latest 100 accessible orders. Ticket references are restricted to
          buyers, organizers and administrators.
        </p>
        {data.orders
          .filter((o) => o.organizer_id === data.userId)
          .map((o) => (
            <article className="claim-row" key={o.id}>
              <h3>
                {o.event_snapshot.title} · {o.status}
              </h3>
              <p>
                {o.quantity} tickets · {o.mode}
              </p>
              {o.status === "CONFIRMED" && (
                <button
                  className="button secondary"
                  onClick={() => void run("cancel-order", { id: o.id })}
                >
                  Cancel attendee registration
                </button>
              )}
            </article>
          ))}
      </section>
      <ModuleHistory data={data} />
    </>
  );
}
export function ModuleReviews({
  data,
  run,
}: {
  data: ModuleData;
  run: ModuleRun;
}) {
  return (
    <section className="panel">
      <h2>Independent listing review</h2>
      <p>
        Latest 100 pending listings, across Phase 3 modules. Owners cannot
        review their own content. Publication approves this exact revision for
        display; it does not verify professional credentials, identity or
        inventory.
      </p>
      {!data.pending.filter((l) => l.owner_id !== data.userId).length && (
        <p>No independently reviewable listings are pending.</p>
      )}
      {data.pending
        .filter((l) => l.owner_id !== data.userId)
        .map((l) => (
          <article className="claim-row" key={l.id}>
            <h3>
              {l.title} · {l.module} · v{l.revision}
            </h3>
            <span className={"badge " + (l.is_demo ? "demo" : "")}>
              {l.is_demo ? "DEMO · FICTITIOUS" : "SELF-SUPPLIED · UNVERIFIED"}
            </span>
            <p>{l.summary}</p>
            <p>
              {l.region} · {formatPrice(l.price_minor, l.currency)}
            </p>
            <Facts listing={l} />
            {l.agent_id && (
              <p>
                Assigned agent acceptance:{" "}
                {l.agent_accepted_revision === l.revision
                  ? "Current"
                  : "Missing or stale"}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run("listing-action", {
                  id: l.id,
                  action: "review",
                  decision: field(f, "decision"),
                  note: field(f, "note"),
                  acknowledge: f.has("acknowledge"),
                });
              }}
            >
              <label>
                Publication decision
                <select name="decision" aria-label="Publication decision">
                  <option value="REJECTED">Reject</option>
                  <option value="PUBLISHED">Publish reviewed content</option>
                </select>
              </label>
              <label>
                Publication review note
                <textarea name="note" required minLength={5} maxLength={2000} />
              </label>
              <label className="checkbox">
                <input name="acknowledge" type="checkbox" required />I reviewed
                this version’s facts and DEMO/unverified disclosures
              </label>
              <button className="button">Record publication review</button>
            </form>
          </article>
        ))}
    </section>
  );
}
function ModuleHistory({ data }: { data: ModuleData }) {
  return (
    <section className="panel">
      <h2>Module activity</h2>
      <p className="fine">Latest 100 accessible immutable workflow events.</p>
      {data.history.map((h) => (
        <p key={h.id}>
          {h.action.replaceAll("_", " ")} ·{" "}
          {new Date(h.created_at).toLocaleString()}
        </p>
      ))}
    </section>
  );
}
