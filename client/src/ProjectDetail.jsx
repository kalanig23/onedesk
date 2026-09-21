import { useEffect, useState } from "react";
import { api } from "./api";
import { STATUS } from "./status";
import { rupees, num } from "./format";

const TASK_STATUS = { todo: "To do", in_progress: "In progress", done: "Done" };

// Sabse bada number: kitna over hai, ya kitna bacha hai
function headline(b) {
  if (b.percentDays > 100) {
    return { big: `${num(-b.remainingDays)} days over`, sub: `Sold ${num(b.budgetDays)} days, used ${num(b.burnedDays)}.` };
  }
  if (b.percentAmount > 100) {
    return { big: `${rupees(-b.remainingAmount)} over`, sub: `Sold ${rupees(b.budgetAmount)}, billed ${rupees(b.burnedAmount)}.` };
  }
  return { big: `${num(b.remainingDays)} days left`, sub: `of ${num(b.budgetDays)} days sold.` };
}

export default function ProjectDetail({ id }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setProject(null);
    setError("");
    api(`/projects/${id}`).then(setProject).catch((e) => setError(e.message));
  }, [id]);

  const back = <a href="#/" className="back">← All projects</a>;

  if (error) {
    return <>{back}<p className="error" role="alert">{error}</p></>;
  }
  if (!project) {
    return <>{back}<p className="muted" aria-live="polite">Loading project...</p></>;
  }

  const b = project.budget;
  const s = STATUS[b.status];
  const pct = Math.max(b.percentDays, b.percentAmount);
  const h = headline(b);

  return (
    <>
      {back}
      <h2 className="title">{project.name}</h2>
      <p className="muted">
        {project.account.name} · Manager: {project.manager?.name ?? "not set"} ·{" "}
        {project.status === "closed" ? "Closed" : "Active"}
      </p>

      <section className={`hero ${b.status}`} aria-label="Budget summary">
        <span className={`badge ${b.status}`}>{s.icon} {s.label}</span>
        <p className="big">{h.big}</p>
        <p className="muted">{h.sub}</p>

        <div
          className={`bar ${b.status}`}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Budget used"
        >
          <div className="fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p><strong>{pct}% used</strong> (days {b.percentDays}%, amount {b.percentAmount}%)</p>
      </section>

      <div className="grid stats">
        <div className="card static">
          <h3>Days</h3>
          <p>Used <strong>{num(b.burnedDays)}</strong> of {num(b.budgetDays)}</p>
          <p className="muted">Remaining: {num(b.remainingDays)}</p>
        </div>
        <div className="card static">
          <h3>Amount (billable)</h3>
          <p>Billed <strong>{rupees(b.burnedAmount)}</strong> of {rupees(b.budgetAmount)}</p>
          <p className="muted">Remaining: {rupees(b.remainingAmount)}</p>
        </div>
        <div className="card static">
          <h3>Hours</h3>
          <p><strong>{num(b.totalHours)}h</strong> total</p>
          <p className="muted">{num(b.billableHours)}h billable · {num(b.nonBillableHours)}h non-billable</p>
        </div>
      </div>

      <h3>Team</h3>
      <p>{project.members.map((m) => m.user.name).join(", ") || "No one is on this project yet."}</p>

      <h3>Tasks</h3>
      {project.tasks.length === 0 ? (
        <p className="muted">No tasks yet. Add the first task to start tracking work.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Task</th><th>Assigned to</th><th>Status</th><th className="right">Hours logged</th></tr>
            </thead>
            <tbody>
              {project.tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.assignee?.name ?? "Unassigned"}</td>
                  <td>{TASK_STATUS[t.status]}</td>
                  <td className="right">{num(t.loggedHours)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}