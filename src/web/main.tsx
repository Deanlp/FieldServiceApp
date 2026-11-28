import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Health = { ok: boolean; appName: string | null };

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? (res.json() as Promise<Health>) : Promise.reject(res.status)))
      .then((body: Health) => setHealth(body))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="shell">
      <h1>{health?.appName ?? "Happy Home Field Service"}</h1>
      <p className="status">
        {error ? "Can't reach the server. Check your connection." : health ? "Connected" : "Connecting…"}
      </p>
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
