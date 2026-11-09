"use client";
import type { Goal } from "@/features/core/domain";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { industries, intents } from "@/features/core/domain";
import type { WorkspaceData, Run } from "@/features/core/ui-types";
import { field, skills, Select } from "./ui";
export function ProfileGoals({
  data: d,
  run,
}: {
  data: WorkspaceData;
  run: Run;
}) {
  const router = useRouter();
  const [step, setStep] = useState(d.profile?.onboarding_complete ? 3 : 1);
  const [goalId] = useState(() => crypto.randomUUID());
  const [industry, setIndustry] = useState("talent"),
    [intent, setIntent] = useState("hire");
  const defaults: Record<string, string> = {
    hire: "work",
    work: "hire",
    buy: "sell",
    sell: "buy",
    partner: "partner",
    attend: "organize",
    organize: "attend",
    promote: "partner",
  };
  return (
    <>
      <div className="stepper">
        {["Choose your direction", "Identity check", "Profile & goal"].map(
          (x, i) => (
            <button
              key={x}
              className={step === i + 1 ? "selected" : ""}
              onClick={() => setStep(i + 1)}
            >
              <span>{i + 1}</span>
              {x}
            </button>
          ),
        )}
      </div>
      <section className="panel form-panel">
        {step === 1 ? (
          <>
            <p className="eyebrow">STEP 01</p>
            <h2>What brings you here?</h2>
            <p className="muted">
              Choose a direction to begin. You can add more goals to this
              account later.
            </p>
            <label>
              Industry
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                {industries.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Your intent
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                {intents.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <button className="button" onClick={() => setStep(2)}>
              Continue →
            </button>
          </>
        ) : step === 2 ? (
          <>
            <p className="eyebrow">STEP 02</p>
            <h2>A trusted network starts with identity.</h2>
            <div className="notice">
              DEMO ONLY. A live identity provider is not connected. This step
              stores a simulated result and reference. It does not verify a real
              identity, and no ID photos are collected.
            </div>
            <p>
              Current status:{" "}
              <strong>{d.identity[0]?.status ?? "Not started"}</strong>
            </p>
            <button
              className="button secondary"
              onClick={() => void run("identity", {})}
            >
              Run demo identity check
            </button>
            <button
              className="button"
              disabled={!d.identity.some((i) => i.status === "DEMO_PASSED")}
              onClick={() => setStep(3)}
            >
              Continue →
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">STEP 03</p>
            <h2>
              {d.profile?.onboarding_complete
                ? "Your profile, your direction"
                : "Make your profile yours"}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (d.profile?.onboarding_complete) {
                  await run("profile", {
                    display_name: field(f, "display_name"),
                    headline: field(f, "headline"),
                    region: field(f, "region"),
                    skills: skills(f),
                    linkedin_url: field(f, "linkedin_url"),
                    onboarding_complete: true,
                  });
                } else if (
                  await run("onboarding", {
                    display_name: field(f, "display_name"),
                    headline: field(f, "headline"),
                    region: field(f, "region"),
                    skills: skills(f),
                    linkedin_url: field(f, "linkedin_url"),
                    goal_id: goalId,
                    industry,
                    intent,
                    target_intent: field(f, "target_intent"),
                    title: field(f, "title"),
                    matching_consent: f.get("matching_consent") === "on",
                  })
                ) {
                  router.replace("/dashboard");
                }
              }}
            >
              <div className="form-grid">
                <label>
                  Display name
                  <input
                    name="display_name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={d.profile?.display_name}
                  />
                </label>
                <label>
                  Region
                  <input
                    name="region"
                    maxLength={100}
                    placeholder="Texas"
                    defaultValue={d.profile?.region}
                  />
                </label>
              </div>
              <label>
                Headline
                <input
                  name="headline"
                  maxLength={240}
                  defaultValue={d.profile?.headline}
                  placeholder="What would you like people to know?"
                />
              </label>
              <label>
                Skills, separated by commas
                <input
                  name="skills"
                  defaultValue={d.profile?.skills.join(", ")}
                  placeholder="testing, ux, mobile"
                />
              </label>
              <label>
                LinkedIn profile (optional, supplied by you)
                <input
                  name="linkedin_url"
                  type="url"
                  defaultValue={d.profile?.linkedin_url}
                  placeholder="https://www.linkedin.com/in/your-profile"
                />
              </label>
              {!d.profile?.onboarding_complete && (
                <>
                  <div className="notice">
                    {industry} · Your intent: {intent}
                  </div>
                  <label>
                    Your first goal
                    <input
                      name="title"
                      required
                      minLength={3}
                      maxLength={160}
                      placeholder="Find product testers for my next release"
                    />
                  </label>
                  <Select
                    name="target_intent"
                    label="Connect with people looking to"
                    options={intents}
                    defaultValue={defaults[intent]}
                  />
                  <label className="check">
                    <input type="checkbox" name="matching_consent" required />I
                    opt in to platform matching (policy 2026-11-v1). I can
                    withdraw in Privacy & settings.
                  </label>
                </>
              )}
              <button className="button">
                {d.profile?.onboarding_complete
                  ? "Save profile"
                  : "Save profile & discover matches"}{" "}
                →
              </button>
            </form>
            <Link className="text-link" href="/dashboard">
              Back to overview →
            </Link>
          </>
        )}
      </section>
      {d.profile?.onboarding_complete && (
        <section className="panel">
          <h2>Your goal profiles</h2>
          <p className="muted">
            Keep multiple goals on one account. Pause a goal to exclude it from
            matching.
          </p>
          {d.goals.map((g) => (
            <article key={g.id}>
              <div className="list-row">
                <div>
                  <strong>{g.title}</strong>
                  <small>
                    {g.industry} · {g.intent} → {g.target_intent}
                  </small>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    void run("goal-toggle", { id: g.id, active: !g.active })
                  }
                >
                  {g.active ? "Pause" : "Activate"}
                </button>
              </div>
              <details>
                <summary>Edit goal: {g.title}</summary>
                <GoalEditor goal={g} run={run} />
              </details>
            </article>
          ))}
          <details>
            <summary>Add another goal</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (
                  await run("goal", {
                    industry: field(f, "industry"),
                    intent: field(f, "intent"),
                    target_intent: field(f, "target_intent"),
                    title: field(f, "title"),
                    region: field(f, "region"),
                    skills: skills(f),
                    active: true,
                  })
                )
                  form.reset();
              }}
            >
              <div className="form-grid">
                <Select name="industry" label="Industry" options={industries} />
                <Select name="intent" label="Your intent" options={intents} />
              </div>
              <Select
                name="target_intent"
                label="Their intent"
                options={intents}
                defaultValue="work"
              />
              <label>
                Goal
                <input name="title" required minLength={3} maxLength={160} />
              </label>
              <label>
                Region
                <input name="region" maxLength={100} />
              </label>
              <label>
                Skills (comma-separated)
                <input name="skills" />
              </label>
              <button className="button">Add goal</button>
            </form>
          </details>
        </section>
      )}
    </>
  );
}

function GoalEditor({ goal: g, run }: { goal: Goal; run: Run }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void run("goal-edit", {
          id: g.id,
          industry: field(f, "industry"),
          intent: field(f, "intent"),
          target_intent: field(f, "target_intent"),
          title: field(f, "title"),
          region: field(f, "region"),
          skills: skills(f),
          active: g.active,
        });
      }}
    >
      <div className="form-grid">
        <Select
          name="industry"
          label="Industry"
          options={industries}
          defaultValue={g.industry}
        />
        <Select
          name="intent"
          label="Your intent"
          options={intents}
          defaultValue={g.intent}
        />
      </div>
      <Select
        name="target_intent"
        label="Their intent"
        options={intents}
        defaultValue={g.target_intent}
      />
      <label>
        Goal
        <input
          name="title"
          required
          minLength={3}
          maxLength={160}
          defaultValue={g.title}
        />
      </label>
      <label>
        Region
        <input name="region" maxLength={100} defaultValue={g.region} />
      </label>
      <label>
        Skills (comma-separated)
        <input name="skills" defaultValue={g.skills.join(", ")} />
      </label>
      <button className="button secondary">Save goal changes</button>
    </form>
  );
}
