import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Role, type User } from "./api";

export function Users({ me }: { me: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("technician");
  const [message, setMessage] = useState<string | null>(null);

  const load = () => api<User[]>("GET", "/users").then(setUsers);
  useEffect(() => {
    load().catch(() => setMessage("Couldn't load users."));
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await api("POST", "/users", { name, email, role });
      setName("");
      setEmail("");
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError && err.code === "email_taken" ? "That email already has an account." : "Couldn't add the user.");
    }
  }

  async function deactivate(user: User) {
    if (!confirm(`Deactivate ${user.name}? They will be signed out straight away.`)) return;
    await api("POST", `/users/${user.id}/deactivate`);
    await load();
  }

  return (
    <section className="stack">
      <h2>Users</h2>
      <ul className="list">
        {users.map((u) => (
          <li key={u.id} className={u.active ? "" : "inactive"}>
            <div>
              <strong>{u.name}</strong> <span className="muted">{u.email}</span>
              <div className="muted small">
                {u.role === "office" ? "Office" : "Technician"}
                {u.isOwner ? " · Owner" : ""}
                {u.active ? "" : " · Deactivated"}
              </div>
            </div>
            {u.active && u.id !== me.id && (
              <button className="secondary" onClick={() => deactivate(u)}>
                Deactivate
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="stack card">
        <h3>Add a user</h3>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="technician">Technician</option>
            <option value="office">Office</option>
          </select>
        </label>
        <button>Add user</button>
      </form>
      {message && <p className="error" role="alert">{message}</p>}
    </section>
  );
}
