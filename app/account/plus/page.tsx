"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate account and return link from external browser storage. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authClient, authHeaders } from "@/lib/auth-client";
import { invitationPath } from "@/lib/invitations";
type Status = {
  configured: boolean;
  active: boolean;
  email?: string;
  remaining?: number;
  pricing?: { amount: number; currency: string };
};
export default function PlusPage() {
  const [status, setStatus] = useState<Status | null>(null),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [back, setBack] = useState("/");
  const refresh = useCallback(async () => {
    try {
      let headers: Record<string, string> = {};
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
        headers = await authHeaders();
      const r = await fetch("/api/billing/status", { headers });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setStatus(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    try {
      const path = invitationPath(
        sessionStorage.getItem("pindou.returnRoom") || "",
      );
      if (path) setBack(path);
    } catch {}
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      return;
    const { data } = authClient().auth.onAuthStateChange(() => {
      setTimeout(() => {
        void refresh();
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  async function login() {
    setBusy(true);
    setError("");
    try {
      const result = sent
        ? await authClient().auth.verifyOtp({
            email,
            token: code,
            type: "email",
          })
        : await authClient().auth.signInWithOtp({ email });
      if (result.error) throw result.error;
      if (!sent) setSent(true);
      else await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function billing(kind: "checkout" | "portal") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/billing/${kind}`, {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      window.location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="plus-page">
      <Link href={back} className="secondary">
        ← Back to the table
      </Link>
      <section className="plus-card">
        <span className="eyebrow">PINDOU PLUS</span>
        <h1>
          A little company.
          <br />A little closer.
        </h1>
        <p>
          Host a voice or video call while you make. Your friends join free.
        </p>
        <ul>
          <li>Up to 4 people, including you</li>
          <li>5 hosted sessions each calendar month (UTC)</li>
          <li>Up to 30 minutes per session, starting when the host opens it</li>
          <li>Private invitations, with microphone and camera off at entry</li>
        </ul>
        <p>
          Free co-op includes all shared bead and box play. Plus adds calls.
        </p>
        {status?.pricing && (
          <p className="plus-price">
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: status.pricing.currency,
            }).format(status.pricing.amount / 100)}{" "}
            <small>/ month · renews until canceled</small>
          </p>
        )}
        {!status ? (
          <p>Checking availability…</p>
        ) : !status.configured ? (
          <p className="call-note">
            Subscriptions and calls aren’t enabled on this studio yet. There’s
            nothing to buy right now.
          </p>
        ) : !status.email ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                disabled={sent}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {sent && (
              <label>
                Email verification code
                <input
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : sent
                  ? "Verify code"
                  : "Email me a sign-in code"}
            </button>
            {sent && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
              >
                Use another email / resend
              </button>
            )}
          </form>
        ) : (
          <>
            <p>Signed in as {status.email}</p>
            {status.active ? (
              <p className="call-note">
                Plus is active. {status.remaining} hosted sessions remain this
                month.
              </p>
            ) : (
              <button
                className="primary"
                disabled={busy}
                onClick={() => billing("checkout")}
              >
                Subscribe with Stripe
              </button>
            )}
            <div className="call-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => billing("portal")}
              >
                Manage subscription
              </button>
              <button
                className="secondary"
                onClick={() => {
                  void authClient().auth.signOut().then(refresh);
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
        {status?.configured && (
          <button
            className="secondary"
            onClick={() => {
              setError("");
              void refresh();
            }}
          >
            Refresh subscription status
          </button>
        )}
        {error && (
          <p role="alert" className="error-copy">
            {error}
          </p>
        )}
        <small>
          Rejoining an active session uses the same allowance. Closing your call
          window leaves the call; its 30-minute timer keeps running. No
          recording is provided.
        </small>
      </section>
    </main>
  );
}
