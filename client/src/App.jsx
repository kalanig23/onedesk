import { useEffect, useState } from "react";
import { api, getUserId, setUserId } from "./api";

const STATUS = {
  ok: { icon: "✓", label: "On track" },
  warning: { icon: "!", label: "Near limit" },
  over: { icon: "▲", label: "Over budget" },
};

function UserPicker() {
  const [users, setUsers] = useState([]);
  const [value, setValue] = useState(getUserId());

  useEffect(() => {
    api("/users").then(setUsers).catch(() => {});
  }, []);

  function change(e) {
    setUserId(e.target.value);
    setValue(e.target.value);
  }

  return (
    <div>
      <label htmlFor="who">I am</label>
      <select id="who" value={value} onChange={change}>
        <option value="">Choose a person</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
        ))}
      </select>
    </div>
  );
}

function ProjectList() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/projects").then(setProjects).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!projects) return <p className="muted">Loading projects...</p>;
  if (projects.length === 0) return <p className="muted">No projects yet. Mark a deal as Won to create one.</p>;

  return (
    <div className="grid">
      {projects.map((p) => {
        const s = STATUS[p.budget.status];
        const pct = Math.max(p.budget.percentDays, p.budget.percentAmount);
        return (
          <button key={p.id} className="card">
            <h3>{p.name}</h3>
            <p className="muted">{p.account.name}</p>
            <p>
              <span className={`badge ${p.budget.status}`}>{s.icon} {s.label}</span>{" "}
              {pct}% used
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  return (
    <>
      <header>
        <h1>OneDesk</h1>
        <UserPicker />
      </header>
      <main>
        <h2>Projects</h2>
        <ProjectList />
      </main>
    </>
  );
}