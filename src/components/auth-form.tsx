"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(action: string, form: HTMLFormElement) {
    setBusy(true);
    setError("");
    setMessage("");
    const fields = new FormData(form);
    if (
      action === "signup" &&
      fields.get("password") !== fields.get("confirmation")
    ) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    const data =
      action === "verify"
        ? { email: fields.get("email"), token: fields.get("token") }
        : action === "resend"
          ? { email: fields.get("email") }
          : { email: fields.get("email"), password: fields.get("password") };
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Please try again.");
      if (action === "login" || action === "verify") {
        router.replace("/dashboard");
        return;
      }
      setMessage(result.message ?? "Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-aside">
        <Link className="brand" href="/">
          n
          <span>
            netcozy<span className="brand-light"> connect</span>
          </span>
        </Link>
        <p className="eyebrow">MORE RELEVANCE. REAL CONNECTIONS.</p>
        <h1>Your next opportunity starts with the right people.</h1>
        <p>
          A focused workspace for your goals, introductions and relationships.
        </p>
        <div className="auth-note">
          One account. Multiple goals. You stay in control.
        </div>
      </div>
      <main className="auth-main">
        <Link className="back" href="/">
          ← Back to Netcozy
        </Link>
        <div className="auth-card">
          <p className="eyebrow">LET’S GET CONNECTED</p>
          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="muted">
            {signup
              ? "Start with your email. Build connections around what matters."
              : "Sign in to your personal workspace."}
          </p>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(signup ? "signup" : "login", e.currentTarget);
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={signup ? 12 : 1}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            {signup && (
              <>
                <small>
                  Use at least 12 characters. Supabase handles password
                  security.
                </small>
                <label>
                  Confirm password
                  <input
                    name="confirmation"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}
            <button className="button full" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}{" "}
              <span>✧</span>
            </button>
          </form>
          <p className="muted">
            {signup ? "Already have an account?" : "New to Netcozy?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <details>
            <summary>Confirm your email or resend a link</summary>
            <p className="muted">
              Use the confirmation link in your email. If your email contains a
              code, you can enter it here.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("verify", e.currentTarget);
              }}
            >
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Confirmation code
                <input
                  name="token"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6,10}"
                />
              </label>
              <button disabled={busy} className="button secondary">
                Confirm email
              </button>
              <button
                disabled={busy}
                className="text-button"
                type="button"
                onClick={(e) => void submit("resend", e.currentTarget.form!)}
              >
                Resend confirmation
              </button>
            </form>
          </details>
        </div>
      </main>
    </div>
  );
}
