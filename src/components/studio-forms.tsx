"use client";
import { useEffect, useState } from "react";
import type {
  Creative,
  StudioData,
  StudioAsset,
} from "@/features/studio/domain";
import { field, Select } from "./ui";
type Run = (action: string, data: unknown) => Promise<unknown>;
export function BrandForm({ data, run }: { data: StudioData; run: Run }) {
  const b = data.brand;
  return (
    <div className="studio-brand-grid">
      <section className="panel">
        <h2>Your business & brand</h2>
        <p className="muted">
          Use information you are authorized to provide. Website links are
          stored for reference; we do not fetch their contents.
        </p>
        <form
          key={b?.revision ?? 0}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(
              "brand-save",
              Object.fromEntries([
                ...[
                  "name",
                  "website",
                  "industry",
                  "audience",
                  "offer",
                  "voice",
                  "color",
                ].map((k) => [k, field(f, k)]),
                ["acknowledge", f.get("acknowledge") === "on"],
              ]),
            );
          }}
        >
          <label>
            Business name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={b?.name}
            />
          </label>
          <label>
            Website (optional, HTTPS)
            <input
              name="website"
              type="url"
              maxLength={300}
              placeholder="https://example.com"
              defaultValue={b?.website}
            />
          </label>
          <label>
            Industry
            <input
              name="industry"
              required
              minLength={2}
              maxLength={100}
              defaultValue={b?.industry}
            />
          </label>
          <label>
            Audience
            <textarea
              name="audience"
              aria-label="Audience"
              required
              minLength={5}
              maxLength={1000}
              defaultValue={b?.audience}
              placeholder="Who are you helping, and what do they need?"
            />
          </label>
          <label>
            Offer & value
            <textarea
              name="offer"
              aria-label="Offer & value"
              required
              minLength={5}
              maxLength={1000}
              defaultValue={b?.offer}
            />
          </label>
          <label>
            Brand voice
            <input
              name="voice"
              required
              minLength={2}
              maxLength={200}
              defaultValue={b?.voice ?? "Clear, warm and professional"}
            />
          </label>
          <label>
            Brand color
            <input
              name="color"
              type="color"
              defaultValue={b?.color ?? "#0f766e"}
            />
          </label>
          <label className="check">
            <input name="acknowledge" type="checkbox" required />I am authorized
            to use this information and will review marketing claims.
          </label>
          {b && (
            <p className="muted">
              Saving brand changes returns existing creatives to draft for fresh
              review.
            </p>
          )}
          <button className="button">Save brand profile</button>
        </form>
      </section>
      <aside className="panel">
        <p className="eyebrow">AUDIENCE BRIEF</p>
        <h2>{b?.name ?? "Give your brand a clear direction"}</h2>
        <p>
          {b?.audience ??
            "Describe the people you want to reach and the value you can offer."}
        </p>
        {b && (
          <>
            <h3>Your message</h3>
            <p>{b.offer}</p>
            <h3>Your voice</h3>
            <p>{b.voice}</p>
            <div
              className="studio-swatch"
              style={{ background: b.color }}
              aria-label={"Brand color " + b.color}
            />
          </>
        )}
        <p className="muted">
          This brief uses your supplied information. AI audience analysis and
          business-data enrichment are awaiting provider setup.
        </p>
      </aside>
    </div>
  );
}
export function CreativeForm({
  creative: c,
  audience,
  run,
  done,
}: {
  creative: Creative | null;
  audience: string;
  run: Run;
  done: () => void;
}) {
  const [mode, setMode] = useState(c ? "manual" : "demo");
  const localDate = c?.scheduled_at
    ? new Date(
        new Date(c.scheduled_at).getTime() -
          new Date(c.scheduled_at).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <section className="panel">
      <div className="row spread">
        <h2>{c ? "Edit creative" : "Prepare your next creative"}</h2>
        {c && (
          <button className="button secondary" onClick={done}>
            Cancel editing
          </button>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const shared = {
            title: field(f, "title"),
            kind: field(f, "kind"),
            channel: field(f, "channel"),
            scheduled_at: field(f, "scheduled_at")
              ? new Date(field(f, "scheduled_at")).toISOString()
              : null,
          };
          void run(
            mode === "demo" ? "demo-prepare" : "creative-save",
            mode === "demo"
              ? shared
              : {
                  ...shared,
                  ...(c ? { id: c.id, revision: c.revision } : {}),
                  caption: field(f, "caption"),
                  script: field(f, "script"),
                  audience: field(f, "audience"),
                },
          ).then((value) => {
            if (value) {
              if (!c) form.reset();
              done();
            }
          });
        }}
      >
        {!c && (
          <label>
            Preparation mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="demo">Demo template — no AI calls</option>
              <option value="manual">Write my own draft</option>
            </select>
          </label>
        )}
        <label>
          Creative title
          <input
            name="title"
            required
            minLength={3}
            maxLength={150}
            defaultValue={c?.title}
          />
        </label>
        <div className="form-grid">
          <Select
            name="kind"
            label="Creative format"
            options={["TEXT", "IMAGE", "VIDEO"]}
            defaultValue={c?.kind}
          />
          <Select
            name="channel"
            label="Channel"
            options={["LINKEDIN", "INSTAGRAM", "FACEBOOK", "MANUAL"]}
            defaultValue={c?.channel}
          />
        </div>
        <label>
          Planned date & time (local, optional)
          <input
            name="scheduled_at"
            type="datetime-local"
            defaultValue={localDate}
          />
        </label>
        {mode === "manual" ? (
          <>
            <label>
              Audience
              <textarea
                name="audience"
                aria-label="Audience"
                required
                minLength={5}
                maxLength={1000}
                defaultValue={c?.audience ?? audience}
              />
            </label>
            <label>
              Caption
              <textarea
                name="caption"
                aria-label="Caption"
                required
                minLength={5}
                maxLength={5000}
                defaultValue={c?.caption}
              />
            </label>
            <label>
              Script / creative brief
              <textarea
                name="script"
                aria-label="Script / creative brief"
                maxLength={10000}
                defaultValue={c?.script}
              />
            </label>
          </>
        ) : (
          <p className="muted">
            Creates editable caption and storyboard text from your brand
            profile. Image/video rendering and AI recommendations are
            unavailable.
          </p>
        )}
        <button className="button">
          {c
            ? "Save revised draft"
            : mode === "demo"
              ? "Prepare demo brief"
              : "Save creative draft"}
        </button>
      </form>
    </section>
  );
}
export function ReviewForm({
  c,
  run,
  asset,
}: {
  c: Creative;
  run: Run;
  asset?: StudioAsset;
}) {
  return (
    <article className="studio-review">
      <h3>
        {c.title} · Revision {c.revision}
      </h3>
      <p>
        {c.channel} · {c.source}
      </p>
      <p className="studio-copy">{c.caption}</p>
      <p className="studio-copy">{c.script}</p>
      <p>Audience: {c.audience}</p>
      {asset && (
        <>
          <p>
            Attached image: {asset.label} · Usage rights: {asset.rights_note}
          </p>
          <AssetLink asset={asset} />
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run("review", {
            id: c.id,
            revision: c.revision,
            decision: field(f, "decision"),
            note: field(f, "note"),
            acknowledge: f.get("acknowledge") === "on",
          });
        }}
      >
        <Select
          name="decision"
          label="Review decision"
          options={["APPROVED", "REJECTED"]}
        />
        <label>
          Review notes
          <textarea name="note" required minLength={5} maxLength={1000} />
        </label>
        <label className="check">
          <input type="checkbox" name="acknowledge" required />I reviewed this
          content, its claims and its intended channel. Approval does not verify
          business claims or publish content.
        </label>
        <button className="button">Record review</button>
      </form>
    </article>
  );
}
export function AssetLink({ asset }: { asset?: StudioAsset }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) return;
    const timer = setTimeout(() => setUrl(""), 60000);
    return () => clearTimeout(timer);
  }, [url]);
  if (!asset || asset.status !== "UPLOADED_UNSCANNED") return null;
  return (
    <div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Open private image (expires in 60 seconds)
        </a>
      ) : (
        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError("");
            void fetch("/api/studio/assets?id=" + asset.id, {
              cache: "no-store",
            })
              .then(async (r) => {
                const b = await r.json();
                if (!r.ok) throw new Error(b.error);
                setUrl(b.url);
              })
              .catch((e) => setError(e.message))
              .finally(() => setLoading(false));
          }}
        >
          Prepare private image link
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
