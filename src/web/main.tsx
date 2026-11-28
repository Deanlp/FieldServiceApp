import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ApiError, type User } from "./api";
import { SignIn } from "./SignIn";
import { Users } from "./Users";
import "./styles.css";

function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api<User>("GET", "/me")
      .then(setUser)
      .catch((err) => (err instanceof ApiError && err.status === 401 ? setUser(null) : setOffline(true)));
  }, []);

  if (offline) return <main className="shell"><p className="error">Can't reach the server. Check your connection.</p></main>;
  if (user === undefined) return <main className="shell"><p className="muted">Loading…</p></main>;
  if (user === null) return <SignIn onSignedIn={setUser} />;

  async function signOut() {
    await api("POST", "/auth/sign-out").catch(() => {});
    setUser(null);
  }

  return (
    <main className="shell stack">
      <header className="topbar">
        <div>
          <h1>Happy Home</h1>
          <p className="muted small">
            {user.name} · {user.role === "office" ? "Office" : "Technician"}
          </p>
        </div>
        <button className="secondary" onClick={signOut}>Sign out</button>
      </header>
      {user.isOwner ? <Users me={user} /> : <p className="muted">Your jobs will appear here.</p>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registered only so the app can be installed to the home screen. It never caches data (ADR 0003).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
