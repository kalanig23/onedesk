import { useEffect, useState } from "react";
import { api, setUser } from "./api";

const BASE_ROLES = [
  { value: "member", label: "Member" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
];

export default function Auth({ onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [hourlyRate, setHourlyRate] = useState("");
  const [allowAdmin, setAllowAdmin] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isRegister = mode === "register";
  const roles = allowAdmin
    ? [{ value: "admin", label: "Admin" }, ...BASE_ROLES]
    : BASE_ROLES;

  useEffect(() => {
    api("/auth/bootstrap")
      .then((d) => {
        setAllowAdmin(Boolean(d.allowAdmin));
        if (d.allowAdmin) setRole((cur) => (cur === "admin" ? cur : "admin"));
      })
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const path = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { name, email, password, role, hourlyRate: Number(hourlyRate) }
        : { email, password };
      const user = await api(path, { method: "POST", body });
      setUser(user);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="card static auth-card">
        <h1>OneDesk</h1>
        <p className="muted">
          {isRegister ? "Create an account to start using OneDesk." : "Log in to continue."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            className={!isRegister ? "active" : ""}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            className={isRegister ? "active" : ""}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Register
          </button>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          {isRegister && (
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>
          {isRegister && (
            <>
              <div className="field">
                <label htmlFor="auth-role">Role</label>
                <select id="auth-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="auth-rate">Hourly rate (₹)</label>
                <input
                  id="auth-rate"
                  type="number"
                  min="0"
                  step="1"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 2000"
                />
                <p className="muted">Used when this person logs time. Admin can be 0.</p>
              </div>
            </>
          )}

          {error && <p className="error" role="alert">{error}</p>}

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Please wait..." : isRegister ? "Create account" : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}
