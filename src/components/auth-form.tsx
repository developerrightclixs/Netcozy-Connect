"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Brand } from "./brand";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [verificationOpen, setVerificationOpen] = useState(false);
  useEffect(() => {
    if (verificationOpen) codeInput.current?.focus();
  }, [verificationOpen]);
  const [now, setNow] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0),
    [emailUntil, setEmailUntil] = useState(0);
  useEffect(() => {
    const deadline = Math.max(blockedUntil, emailUntil);
    if (!deadline) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [blockedUntil, emailUntil]);
  const blocked = (action: string) =>
    busy ||
    now < blockedUntil ||
    (["signup", "resend"].includes(action) && now < emailUntil);

  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(action: string, form: HTMLFormElement) {
    if (
      inFlight.current ||
      busy ||
      now < blockedUntil ||
      (["signup", "resend"].includes(action) && now < emailUntil)
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const fields = new FormData(form);
    if (
      action === "signup" &&
      fields.get("password") !== fields.get("confirmation")
    ) {
      inFlight.current = false;
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
      if (response.status === 429) {
        const seconds =
          Number.isSafeInteger(result.retryAfterSeconds) &&
          result.retryAfterSeconds > 0
            ? result.retryAfterSeconds
            : 60;
        const time = Date.now();
        setNow(time);
        if (result.code === "AUTH_EMAIL_RATE_LIMITED")
          setEmailUntil(time + seconds * 1000);
        else setBlockedUntil(time + seconds * 1000);
      }
      if (!response.ok) throw new Error(result.error ?? "Please try again.");
      if (["signup", "resend"].includes(action)) {
        const time = Date.now();
        setNow(time);
        setEmailUntil(time + 60000);
        setVerificationEmail(String(fields.get("email") ?? "").trim());
        setVerificationOpen(true);
      }

      if (action === "login" || action === "verify") {
        router.replace("/dashboard");
        return;
      }
      setMessage(result.message ?? "Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-aside">
        <Brand href="/" />
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
          <h1>
            {signup && verificationEmail !== null
              ? "Verify your email"
              : signup
                ? "Create your account"
                : "Welcome back"}
          </h1>
          <p className="muted">
            {signup && verificationEmail !== null
              ? "Enter the verification code from your email to finish creating your account."
              : signup
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
          {Math.max(blockedUntil, emailUntil) > now && (
            <p className="fine" role="status">
              Wait at least{" "}
              {Math.ceil((Math.max(blockedUntil, emailUntil) - now) / 1000)}{" "}
              seconds before another{" "}
              {blockedUntil > now
                ? "authentication attempt"
                : "confirmation email request"}
              . Email service limits can last longer.
            </p>
          )}
          {!(signup && verificationEmail !== null) && (
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
              <button
                className="button full"
                disabled={blocked(signup ? "signup" : "login")}
              >
                {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}{" "}
                <span>✧</span>
              </button>
            </form>
          )}
          <p className="muted">
            {signup ? "Already have an account?" : "New to Netcozy?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <details
            open={verificationOpen}
            onToggle={(e) => setVerificationOpen(e.currentTarget.open)}
          >
            <summary>Enter a verification code or resend code</summary>
            <p className="muted">
              Check your inbox and spam folder. Enter the code exactly as shown
              in the email. Use the newest code if you requested another email.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("verify", e.currentTarget);
              }}
            >
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={verificationEmail ?? ""}
                  onChange={(e) => setVerificationEmail(e.target.value)}
                />
              </label>
              <label>
                Confirmation code
                <input
                  name="token"
                  ref={codeInput}
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={10}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6,10}"
                />
              </label>
              <button disabled={blocked("verify")} className="button secondary">
                Verify email
              </button>
              <button
                disabled={blocked("resend")}
                className="text-button"
                type="button"
                onClick={(e) => void submit("resend", e.currentTarget.form!)}
              >
                Resend code
              </button>
            </form>
          </details>
          {signup && verificationEmail !== null && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setVerificationEmail(null);
                setVerificationOpen(false);
                setError("");
                setMessage("");
              }}
            >
              Use a different signup email
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
