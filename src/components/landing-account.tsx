"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function LandingAccount() {
  const [account, setAccount] = useState<{ name: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!controller.signal.aborted) setAccount(result?.account ?? null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="row landing-account">
      {account ? (
        <Link className="button landing-account-name" href="/dashboard">
          {account.name || "My workspace"}
        </Link>
      ) : (
        <>
          <Link href="/login">Sign in</Link>
          <Link className="button" href="/signup">
            Get started →
          </Link>
        </>
      )}
    </div>
  );
}
