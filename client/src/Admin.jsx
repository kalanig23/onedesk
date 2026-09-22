import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { rupees, num } from "./format";

const ROLE_LABEL = { admin: "Admin", sales: "Sales", manager: "Manager", member: "Member" };
const ROLE_KEYS = ["admin", "sales", "manager", "member"];

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

function RecordBlock({ title, empty, children, count }) {
  return (
    <div className="admin-block">
      <h4>{title} <span className="muted">{count}</span></h4>
      {count === 0 ? <p className="muted">{empty}</p> : children}
    </div>
  );
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  function load() {
    api("/admin/people").then(setData).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const people = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.people.filter((p) => {
      if (filter !== "all" && p.role !== filter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    });
  }, [data, filter, query]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <p className="muted">Loading admin panel...</p>;

  const total = data.people.length;

  return (
    <div className="admin-page">
      <div className="page-head">
        <div>
          <h2 className="title">Admin panel</h2>
          <p className="muted">Who is in OneDesk, their role, and the work attached to them.</p>
        </div>
        <label className="admin-search">
          <span className="sr-only">Search people</span>
          <input
            type="search"
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="pill-row" role="tablist" aria-label="Filter by role">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          className={`pill ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All <strong>{total}</strong>
        </button>
        {ROLE_KEYS.map((role) => (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={filter === role}
            className={`pill ${filter === role ? "active" : ""}`}
            onClick={() => setFilter(role)}
          >
            {ROLE_LABEL[role]} <strong>{data.roles[role] || 0}</strong>
          </button>
        ))}
      </div>

      {people.length === 0 ? (
        <p className="muted">No one matches this filter.</p>
      ) : (
        <div className="scroll admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Work</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const open = openId === p.id;
                return (
                  <PersonRows
                    key={p.id}
                    person={p}
                    open={open}
                    onToggle={() => setOpenId(open ? null : p.id)}
                    onReload={load}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PersonRows({ person: p, open, onToggle, onReload }) {
  const [rate, setRate] = useState(String(p.hourlyRate));
  const [rateBusy, setRateBusy] = useState(false);

  useEffect(() => {
    setRate(String(p.hourlyRate));
  }, [p.hourlyRate]);

  async function saveRate() {
    const n = Number(rate);
    if (!Number.isInteger(n) || n < 0) return;
    if (n === p.hourlyRate) return;
    setRateBusy(true);
    try {
      await api(`/admin/people/${p.id}`, { method: "PATCH", body: { hourlyRate: n } });
      await onReload();
    } catch (err) {
      window.alert(err.message);
      setRate(String(p.hourlyRate));
    } finally {
      setRateBusy(false);
    }
  }
  return (
    <>
      <tr className={open ? "open-row" : ""}>
        <td>
          <div className="person-cell">
            <span className={`avatar role-${p.role}`} aria-hidden="true">{initials(p.name)}</span>
            <span>
              <strong>{p.name}</strong>
              <span className="muted block">{p.email}</span>
            </span>
          </div>
        </td>
        <td><span className={`badge role-${p.role}`}>{ROLE_LABEL[p.role] || p.role}</span></td>
        <td>
          <span className="work-chips">
            <span>{p._count.ownedDeals} deals</span>
            <span>{p._count.managedProjects + p._count.memberships} projects</span>
            <span>{p._count.timeEntries} time</span>
            <span className="muted rate-edit">
              ₹
              <input
                type="number"
                min="0"
                step="1"
                value={rate}
                disabled={rateBusy}
                aria-label={`Hourly rate for ${p.name}`}
                onChange={(e) => setRate(e.target.value)}
                onBlur={saveRate}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              /h
            </span>
          </span>
        </td>
        <td>
          <button type="button" className={open ? "primary" : ""} onClick={onToggle}>
            {open ? "Close" : "Records"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="records-row">
          <td colSpan={4}>
            <div className="admin-records">
              <RecordBlock title="Deals owned" empty="No deals." count={p.ownedDeals.length}>
                <table>
                  <thead>
                    <tr><th>Deal</th><th>Company</th><th>Stage</th><th className="right">Value</th></tr>
                  </thead>
                  <tbody>
                    {p.ownedDeals.map((d) => (
                      <tr key={d.id}>
                        <td><a href={`#/deals/${d.id}`}>{d.title}</a></td>
                        <td>{d.account.name}</td>
                        <td><span className={`stage ${d.stage}`}>{d.stage.replace("_", " ")}</span></td>
                        <td className="right">{rupees(d.expectedValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </RecordBlock>

              <RecordBlock title="Projects managed" empty="None managed." count={p.managedProjects.length}>
                <ul className="record-list">
                  {p.managedProjects.map((proj) => (
                    <li key={proj.id}>
                      <a href={`#/projects/${proj.id}`}>{proj.name}</a>
                      <span className="muted"> · {proj.account.name} · {proj.status}</span>
                    </li>
                  ))}
                </ul>
              </RecordBlock>

              <RecordBlock title="On delivery teams" empty="Not on a project." count={p.memberships.length}>
                <ul className="record-list">
                  {p.memberships.map((m) => (
                    <li key={m.project.id}>
                      <a href={`#/projects/${m.project.id}`}>{m.project.name}</a>
                      <span className="muted"> · {m.project.status}</span>
                    </li>
                  ))}
                </ul>
              </RecordBlock>

              <RecordBlock title="Recent time" empty="No time logged." count={p.timeEntries.length}>
                <table>
                  <thead>
                    <tr><th>Date</th><th>Task</th><th>Project</th><th className="right">Hours</th></tr>
                  </thead>
                  <tbody>
                    {p.timeEntries.map((e) => (
                      <tr key={e.id}>
                        <td>{String(e.date).slice(0, 10)}</td>
                        <td>{e.task.title}</td>
                        <td>{e.task.project.name}</td>
                        <td className="right">{num(e.hours)}h{e.billable ? "" : " nb"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </RecordBlock>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
