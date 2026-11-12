"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Creative, StudioData } from "@/features/studio/domain";
import { WorkspaceLoader } from "./workspace-loader";
import { Empty, field } from "./ui";
import { BrandForm, CreativeForm, ReviewForm, AssetLink } from "./studio-forms";
import { Reports } from "./studio-reports";
type Run = (action: string, data: unknown) => Promise<unknown>;
async function fetchStudio(): Promise<StudioData | null> {
  const r = await fetch("/api/studio", { cache: "no-store" });
  if (r.status === 401) return null;
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? "Unable to load LI3K Studio.");
  return body;
}
function download(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "li3k-reviewed-creative.json";
  link.click();
  URL.revokeObjectURL(url);
}
export function StudioWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<StudioData | null>(null),
    [tab, setTab] = useState("Brand & audience"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Creative | null>(null);
  const load = useCallback(async () => {
    const body = await fetchStudio();
    if (!body) router.replace("/login");
    else setData(body);
  }, [router]);
  useEffect(() => {
    let active = true;
    void fetchStudio()
      .then((body) => {
        if (!active) return;
        if (!body) router.replace("/login");
        else setData(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [router]);
  const run: Run = async (action, input) => {
    if (busy) return null;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(
        input instanceof FormData ? "/api/studio/assets" : "/api/studio",
        {
          method: "POST",
          ...(input instanceof FormData
            ? { body: input }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, data: input }),
              }),
        },
      );
      const body = await r.json();
      if (!r.ok)
        throw new Error(body.error ?? "Unable to save studio changes.");
      await load();
      setMessage(
        action === "export"
          ? "Reviewed package prepared. Publish manually on your authorized account."
          : "Studio changes saved.",
      );
      return body.result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return error ? (
      <div className="notice error" role="alert">
        {error}{" "}
        <button
          className="button"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Try again
        </button>
      </div>
    ) : (
      <WorkspaceLoader />
    );
  const tabs = [
    "Brand & audience",
    "Creative library",
    "Media library",
    "Calendar",
    "Review queue",
    "Usage & reports",
  ];
  return (
    <div className="studio-workspace">
      <div className="studio-hero">
        <div>
          <p className="eyebrow">LI3K MARKETING STUDIO</p>
          <h2>From your story to your next post.</h2>
          <p>
            Shape your brand, prepare content and review every detail before
            sharing.
          </p>
        </div>
        <span className="pill">Manual publication</span>
      </div>
      <nav className="studio-tabs" aria-label="Studio sections">
        {tabs.map((name) => (
          <button
            key={name}
            className={tab === name ? "button active" : "button secondary"}
            aria-current={tab === name ? "page" : undefined}
            onClick={() => {
              setTab(name);
              setMessage("");
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      <fieldset className="workspace-fields" disabled={busy} aria-busy={busy}>
        {tab === "Brand & audience" && <BrandForm data={data} run={run} />}
        {tab === "Creative library" && (
          <>
            {!data.brand ? (
              <Empty title="Start with your brand">
                Save a business profile in Brand & audience first.
              </Empty>
            ) : (
              <>
                <CreativeForm
                  key={(editing?.id ?? "new") + ":" + (editing?.revision ?? 0)}
                  creative={editing}
                  audience={data.brand.audience}
                  run={run}
                  done={() => setEditing(null)}
                />
                <div className="studio-library">
                  {data.creatives.map((c) => (
                    <article className="panel studio-card" key={c.id}>
                      <div className="row spread">
                        <span className="pill">{c.kind} brief</span>
                        <span className="pill">
                          {c.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <h3>{c.title}</h3>
                      <p className="muted">
                        {c.channel} · Revision {c.revision} ·{" "}
                        {c.source === "DEMO_TEMPLATE"
                          ? "Demo template"
                          : "Manual draft"}
                      </p>
                      <p className="studio-copy">{c.caption}</p>
                      <details>
                        <summary>Creative brief / script</summary>
                        <p className="studio-copy">
                          {c.script || "No script supplied."}
                        </p>
                        <p>Audience: {c.audience}</p>
                      </details>
                      {c.kind !== "TEXT" && (
                        <>
                          <p className="muted">
                            No image or video file has been generated. You may
                            attach an authorized uploaded image; video rendering
                            is unavailable.
                          </p>
                          {c.asset_id && (
                            <AssetLink
                              asset={data.assets.find(
                                (a) => a.id === c.asset_id,
                              )}
                            />
                          )}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              void run("asset-attach", {
                                id: field(f, "asset_id"),
                                creative_id: c.id,
                                revision: c.revision,
                              });
                            }}
                          >
                            <label>
                              Attach library image
                              <select name="asset_id" required>
                                <option value="">
                                  Select an uploaded image
                                </option>
                                {data.assets
                                  .filter(
                                    (a) => a.status === "UPLOADED_UNSCANNED",
                                  )
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.label}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button className="button secondary">
                              Attach & reset review
                            </button>
                          </form>
                        </>
                      )}
                      <p className="muted">
                        {c.scheduled_at
                          ? "Planned: " +
                            new Date(c.scheduled_at).toLocaleString()
                          : "No planned date"}
                      </p>
                      <div className="row">
                        <button
                          className="button secondary"
                          onClick={() => {
                            setEditing(c);
                            window.scrollTo({ top: 0, behavior: "instant" });
                          }}
                        >
                          Edit
                        </button>
                        {c.status === "DRAFT" && (
                          <button
                            className="button"
                            onClick={() =>
                              void run("submit", {
                                id: c.id,
                                revision: c.revision,
                              })
                            }
                          >
                            Submit for review
                          </button>
                        )}
                        {["APPROVED", "EXPORTED"].includes(c.status) && (
                          <button
                            className="button"
                            onClick={() =>
                              void run("export", {
                                id: c.id,
                                revision: c.revision,
                              }).then((value) => {
                                if (value) download(value);
                              })
                            }
                          >
                            Export reviewed package
                          </button>
                        )}
                      </div>
                      {data.reviews
                        .filter((r) => r.creative_id === c.id)
                        .map((r) => (
                          <p className="notice" key={r.id}>
                            Review of revision {r.revision}: {r.decision} —{" "}
                            {r.note}
                          </p>
                        ))}
                    </article>
                  ))}
                </div>
                {!data.creatives.length && (
                  <Empty title="Your library starts here">
                    Prepare a demo brief or write your own first draft.
                  </Empty>
                )}
              </>
            )}
          </>
        )}
        {tab === "Media library" && (
          <section className="panel">
            <h2>Your private media library</h2>
            <p className="muted">
              Upload PNG or JPEG images up to 2 MB. Files are private and
              immutable. Uploaded files are not malware-scanned. Video uploads
              and generated media are unavailable.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                void run("asset-upload", new FormData(form)).then((value) => {
                  if (value) form.reset();
                });
              }}
            >
              <label>
                Image label
                <input name="label" required minLength={3} maxLength={120} />
              </label>
              <label>
                Image file
                <input
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg"
                  required
                />
              </label>
              <label>
                Usage rights / source note
                <input
                  name="rights_note"
                  required
                  minLength={5}
                  maxLength={500}
                />
              </label>
              <label className="check">
                <input type="checkbox" name="acknowledge" required />I have
                permission to use this image in marketing materials.
              </label>
              <button className="button">Upload private image</button>
            </form>
            <div className="studio-library">
              {data.assets.map((a) => (
                <article className="panel" key={a.id}>
                  <h3>{a.label}</h3>
                  <p>
                    {a.status.replaceAll("_", " ")} ·{" "}
                    {Math.ceil(a.byte_size / 1024)} KB
                  </p>
                  <p>{a.rights_note}</p>
                  <AssetLink asset={a} />
                </article>
              ))}
            </div>
            {!data.assets.length && (
              <Empty title="No uploaded media">
                Add images you are authorized to use, then attach them to
                creative drafts.
              </Empty>
            )}
          </section>
        )}
        {tab === "Calendar" && (
          <section className="panel">
            <h2>Content calendar</h2>
            <p className="muted">
              Planning only. Dates display in your local time. Posts are never
              automatically published.
            </p>
            {data.creatives
              .filter((c) => c.scheduled_at)
              .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
              .map((c) => (
                <div className="studio-calendar-row" key={c.id}>
                  <time dateTime={c.scheduled_at!}>
                    {new Date(c.scheduled_at!).toLocaleString()}
                  </time>
                  <strong>{c.title}</strong>
                  <span>
                    {c.channel} · {c.status.replaceAll("_", " ")}
                  </span>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(c);
                      setTab("Creative library");
                    }}
                  >
                    Open draft
                  </button>
                </div>
              ))}
            {!data.creatives.some((c) => c.scheduled_at) && (
              <Empty title="No planned content">
                Add a planned date when saving a creative draft.
              </Empty>
            )}
          </section>
        )}
        {tab === "Review queue" && (
          <section className="panel">
            <h2>Independent content review</h2>
            <p className="muted">
              An administrator other than the owner reviews the current
              revision. Editing content or brand settings clears approval.
            </p>
            {data.pending.map((c) => (
              <ReviewForm
                key={c.id + ":" + c.revision}
                c={c}
                run={run}
                asset={data.assets.find((a) => a.id === c.asset_id)}
              />
            ))}
            {!data.pending.length && (
              <Empty title="No reviews available">
                Administrators see pending submissions here. Track your own
                submission status in the creative library.
              </Empty>
            )}
          </section>
        )}
        {tab === "Usage & reports" && <Reports data={data} run={run} />}
      </fieldset>
      <p className="muted">
        Library, review, export, usage and report panels show up to 100 recent
        records each.
      </p>
    </div>
  );
}
