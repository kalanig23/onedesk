import { useEffect, useState } from "react";
import { api, getUserId, setUserId } from "./api";
import { STATUS } from "./status";
import ProjectDetail from "./ProjectDetail";
import LogTime from "./LogTime";

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function UserPicker() {
  const [users, setUsers] = useState([]);
  const [value, setValue] = useState(getUserId());

  useEffect(() => {
    api("/users").then(setUsers).catch(() => {});
  }, []);

  function change(e) {
    setUserId(e.target.value);
    setValue(e.target.value);
    window.location.reload(); // har screen naye user ke hisaab se dobara load ho
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
          <a key={p.id} href={`#/projects/${p.id}`} className="card">
            <h3>{p.name}</h3>
            <p className="muted">{p.account.name}</p>
            <p>
              <span className={`badge ${p.budget.status}`}>{s.icon} {s.label}</span>{" "}
              {pct}% used
            </p>
          </a>
        );
      })}
    </div>
  );
}

export default function App() {
  const hash = useHash();
  const match = hash.match(/^#\/projects\/(\d+)$/);

  let page;
  if (match) {
    page = <ProjectDetail id={match[1]} />;
  } else if (hash === "#/log") {
    page = <LogTime />;
  } else {
    page = (
      <>
        <h2>Projects</h2>
        <ProjectList />
      </>
    );
  }

  return (
    <>
      <header>
        <h1><a href="#/" className="home">OneDesk</a></h1>
        <nav>
          <a href="#/">Projects</a>
          <a href="#/log">Log time</a>
        </nav>
        <UserPicker />
      </header>
      <main>{page}</main>
    </>
  );
}