import { useState, type FormEvent } from "react";
import { api, ApiError, type User } from "./api";

export function SignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api("POST", "/auth/request-code", { email });
      setStep("code");
    } catch {
      setMessage("Couldn't send a code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      onSignedIn(await api<User>("POST", "/auth/verify", { email, code }));
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 401
          ? "That code didn't work. It may be wrong or older than 10 minutes."
          : "Couldn't sign in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell narrow">
      <h1>Happy Home Field Service</h1>
      {step === "email" ? (
        <form onSubmit={requestCode} className="stack">
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p className="muted">If {email} has an account, a 6-digit code is on its way.</p>
          <label>
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="link" onClick={() => { setStep("email"); setCode(""); }}>
            Use a different email
          </button>
        </form>
      )}
      {message && <p className="error" role="alert">{message}</p>}
    </main>
  );
}
