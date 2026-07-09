"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    "Access is currently limited. Other addresses will join the waitlist.",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(result.message || result.error || "Unable to continue.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="auth-kicker">Sushicode private beta</span>
        <h1>Shared context for people and agents.</h1>
        <p>
          Sign in with the approved project email. Everyone else is added to the
          waitlist—there is no open account creation.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email address</label>
          <div>
            <input
              autoComplete="email"
              id="auth-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
            <button disabled={busy} type="submit">
              {busy ? "Sending…" : "Continue"}
            </button>
          </div>
        </form>
        <output aria-live="polite">{message}</output>
      </section>
    </main>
  );
}
