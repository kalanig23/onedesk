import { useEffect, useState } from "react";
import { api, getUser, clearUser } from "./api";
import { STATUS } from "./status";
import { navFor, isAdmin, canOpen, isNavActive } from "./roles";
import ProjectDetail from "./ProjectDetail";
import LogTime from "./LogTime";
import Accounts from "./Accounts";
import AccountDetail from "./AccountDetail";
import Deals from "./Deals";
import DealDetail from "./DealDetail";
import Forecast from "./Forecast";
import Admin from "./Admin";
import Auth from "./Auth";

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function SessionBar({ user, onLogout }) {
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="session">
      <span className={`avatar sm role-${user.role}`} aria-hidden="true">{initials}</span>
      <span className="session-who">
        <strong>{user.name}</strong>
        <span className={`badge role-${user.role}`}>{user.role}</span>
      </span>
      <button type="button" onClick={onLogout}>Log out</button>
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
  if (projects.length === 0) return <p className="muted">No projects yet. When sales marks a deal Won, it shows up here.</p>;

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

function pageFor(user, hash) {
  if (!canOpen(user, hash) && hash !== "#/" && hash !== "") {
    return (
      <p className="error" role="alert">
        {user.role === "sales"
          ? "Projects and timesheets are delivery’s tools. Use Accounts, Deals and Forecast."
          : "The sales pipeline is Priya’s workspace. Use Projects and Log time."}
      </p>
    );
  }

  const project = hash.match(/^#\/projects\/(\d+)$/);
  const account = hash.match(/^#\/accounts\/(\d+)$/);
  const deal = hash.match(/^#\/deals\/(\d+)$/);

  if (isAdmin(user)) {
    if (account) return <AccountDetail id={account[1]} />;
    if (deal) return <DealDetail id={deal[1]} />;
    if (project) return <ProjectDetail id={project[1]} user={user} />;
    if (hash === "#/accounts") return <Accounts />;
    if (hash === "#/deals") return <Deals />;
    if (hash === "#/forecast") return <Forecast />;
    if (hash === "#/log") return <LogTime />;
    if (hash === "#/projects") {
      return (
        <>
          <h2>Projects</h2>
          <ProjectList />
        </>
      );
    }
    return <Admin />;
  }

  if (user.role === "sales") {
    if (account) return <AccountDetail id={account[1]} />;
    if (deal) return <DealDetail id={deal[1]} />;
    if (hash === "#/accounts") return <Accounts />;
    if (hash === "#/deals") return <Deals />;
    return <Forecast />;
  }

  if (project) return <ProjectDetail id={project[1]} user={user} />;
  if (hash === "#/log") return <LogTime />;
  return (
    <>
      <h2>Projects</h2>
      <ProjectList />
    </>
  );
}

export default function App() {
  const hash = useHash();
  const [user, setCurrentUser] = useState(getUser);

  function logout() {
    clearUser();
    setCurrentUser(null);
    window.location.hash = "#/";
  }

  if (!user) {
    return <Auth onLoggedIn={setCurrentUser} />;
  }

  const items = navFor(user);

  return (
    <>
      <header>
        <h1><a href="#/" className="home">OneDesk</a></h1>
        <SessionBar user={user} onLogout={logout} />
        <nav aria-label="Main">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={isNavActive(hash, item.href, items) ? "active" : ""}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main>{pageFor(user, hash)}</main>
    </>
  );
}
