"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { isAdmin } from "@/features/core/domain";
import type { WorkspaceData, Run } from "@/features/core/ui-types";
import { Overview } from "./workspace-overview";
import { ProfileGoals } from "./workspace-profile";
import { Matches, Outreach } from "./workspace-matches";
import { Pipeline, Settings } from "./workspace-settings";
import { Admin } from "./workspace-admin";
import { PropertyWorkspace } from "./property-workspace";
import { Brand, NavIcon } from "./brand";
import { WorkspaceLoader } from "./workspace-loader";
import { ModuleWorkspace } from "./module-workspace";
const nav = [
  ["dashboard", "Overview", "◈"],
  ["onboarding", "Profile & goals", "◎"],
  ["matches", "Discover matches", "✧"],
  ["outreach", "Outreach drafts", "↗"],
  ["pipeline", "My pipeline", "▤"],
  ["properties", "Properties & forms", "⌂"],
  ["talent", "Talent & testers", ""],
  ["marketplace", "Yachts & vehicles", ""],
  ["events", "Events & tickets", ""],
  ["settings", "Privacy & settings", "⚙"],
];
export function Workspace({ section }: { section: string }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/core", { cache: "no-store" });
    if (r.status === 401) {
      router.replace("/login");
      return;
    }
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Unable to load your workspace.");
    setData(body);
  }, [router]);
  useEffect(() => {
    let active = true;
    fetch("/api/core", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Unable to load workspace.");
        if (active) setData(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [router]);
  const run: Run = async (action, input) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: input }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Unable to save.");
      await load();
      setMessage("Saved successfully.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok) throw new Error("Unable to sign out.");
      router.replace("/login");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const name = data?.profile?.display_name || "Your workspace";
  return (
    <div className="app-shell">
      <a className="skip" href="#workspace-main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Workspace">
          {nav.map(([path, label]) => (
            <Link
              key={path}
              href={"/" + path}
              aria-current={section === path ? "page" : undefined}
              className={section === path ? "active" : ""}
            >
              <NavIcon name={path} />
              {label}
            </Link>
          ))}
          {data && isAdmin(data.roles) && (
            <Link href="/admin" className={section === "admin" ? "active" : ""}>
              <NavIcon name="admin" />
              Administration
            </Link>
          )}
        </nav>
        <div className="sidebar-note">
          <span>✧</span>
          <strong>Connections with purpose</strong>
          <p>Focus on the people and opportunities that fit your goals.</p>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{name[0]?.toUpperCase()}</div>
          <div>
            <strong>{name}</strong>
            <small>{data?.roles.join(" · ") ?? "Member workspace"}</small>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span>
            Workspace{" "}
            <span className="muted">/ {section.replace("-", " ")}</span>
          </span>
          <div className="row">
            <span className="environment-dot">Development</span>
            <button
              className="text-button"
              onClick={() => void logout()}
              disabled={busy}
            >
              Sign out →
            </button>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAKE EVERY CONNECTION COUNT</p>
              <h1>
                {section === "dashboard"
                  ? "Welcome" +
                    (data?.profile?.display_name
                      ? ", " + data.profile.display_name.split(" ")[0]
                      : "") +
                    "."
                  : (nav.find((n) => n[0] === section)?.[1] ??
                    "Administration")}
              </h1>
              <p className="muted">
                {section === "dashboard"
                  ? "A little clarity. The right people. Your next step."
                  : "A focused space for your next meaningful connection."}
              </p>
            </div>
            <span className="pill">
              {section === "properties"
                ? "REAL ESTATE · PREVIEW"
                : "WORKSPACE · PREVIEW"}
            </span>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}{" "}
              {!data && (
                <button
                  className="text-button"
                  onClick={() => void load().catch((e) => setError(e.message))}
                >
                  Try again
                </button>
              )}
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              {message}
            </div>
          )}
          {!data && !error && <WorkspaceLoader />}
          {data && (
            <fieldset
              className="workspace-fields"
              disabled={busy}
              aria-busy={busy}
            >
              {section === "dashboard" ? (
                <Overview data={data} />
              ) : section === "onboarding" ? (
                <ProfileGoals data={data} run={run} />
              ) : section === "matches" ? (
                <Matches data={data} run={run} />
              ) : section === "outreach" ? (
                <Outreach data={data} run={run} />
              ) : section === "pipeline" ? (
                <Pipeline data={data} run={run} />
              ) : section === "properties" ? (
                <PropertyWorkspace />
              ) : ["talent", "marketplace", "events"].includes(section) ? (
                <ModuleWorkspace key={section} section={section} />
              ) : section === "settings" ? (
                <Settings data={data} run={run} />
              ) : (
                <Admin data={data} run={run} />
              )}
            </fieldset>
          )}
        </main>
        <footer className="workspace-footer">
          Built around relevance. Powered by your choices.
        </footer>
      </div>
    </div>
  );
}
