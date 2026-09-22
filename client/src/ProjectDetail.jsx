import { useEffect, useState } from "react";
import { api } from "./api";
import { STATUS } from "./status";
import { rupees, num } from "./format";

const TASK_STATUS = { todo: "To do", in_progress: "In progress", done: "Done" };

function headline(b) {
  if (b.percentDays > 100) {
    return { big: `${num(-b.remainingDays)} days over`, sub: `Sold ${num(b.budgetDays)} days, used ${num(b.burnedDays)}.` };
  }
  if (b.percentAmount > 100) {
    return { big: `${rupees(-b.remainingAmount)} over`, sub: `Sold ${rupees(b.budgetAmount)}, billed ${rupees(b.burnedAmount)}.` };
  }
  return { big: `${num(b.remainingDays)} days left`, sub: `of ${num(b.budgetDays)} days sold.` };
}

export default function ProjectDetail({ id, user }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [addUserId, setAddUserId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [formError, setFormError] = useState("");
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    setProject(null);
    setError("");
    api(`/projects/${id}`)
      .then((p) => {
        setProject(p);
        if (p.canManage) api("/users").then(setUsers).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function reload() {
    setProject(await api(`/projects/${id}`));
  }

  const back = <a href="#/" className="back">← All projects</a>;

  if (error) {
    return <>{back}<p className="error" role="alert">{error}</p></>;
  }
  if (!project) {
    return <>{back}<p className="muted" aria-live="polite">Loading project...</p></>;
  }

  const manage = project.canManage;
  const b = project.budget;
  const s = STATUS[b.status];
  const pct = Math.max(b.percentDays, b.percentAmount);
  const h = headline(b);
  const progress = project.progress || { total: 0, done: 0, percent: 0 };

  async function patchTask(taskId, body) {
    setFormError("");
    try {
      await api(`/tasks/${taskId}`, { method: "PATCH", body });
      await reload();
    } catch (err) {
      setFormError(err.message);
    }
  }

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
        {b.status === "over" && b.overrunOn ? (
          <p>We crossed the sold line on <strong>{b.overrunOn}</strong>. Anyone on the project can see this without exporting a timesheet.</p>
        ) : null}

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

      <section className="card static" aria-label="Team progress">
        <h3>Team progress</h3>
        <p className="muted">Everyone on the project sees this: {progress.done} of {progress.total} tasks done.</p>
        <div
          className="bar ok"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tasks complete"
        >
          <div className="fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <p><strong>{progress.percent}% complete</strong></p>
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

      <h3>Draft invoice</h3>
      <p className="muted">
        Billable hours rolled up against the proposal that was sold ({rupees(b.budgetAmount)}).
        Margin on this draft: {rupees(b.budgetAmount - (project.invoice?.amount || 0))}.
      </p>
      {(!project.invoice || project.invoice.lines.length === 0) ? (
        <p className="muted">No hours logged yet. When the team logs time, the invoice lines appear here.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Person</th><th className="right">Hours (all)</th><th className="right">Billable</th><th className="right">Amount</th></tr>
            </thead>
            <tbody>
              {project.invoice.lines.map((line) => (
                <tr key={line.person}>
                  <td>{line.person}</td>
                  <td className="right">{num(line.hours)}h</td>
                  <td className="right">{num(line.billableHours)}h</td>
                  <td className="right">{rupees(line.amount)}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Invoice total</strong></td>
                <td className="right"></td>
                <td className="right"><strong>{num(project.invoice.billableHours)}h</strong></td>
                <td className="right"><strong>{rupees(project.invoice.amount)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {formError && <p className="error" role="alert">{formError}</p>}

      <h3>Team</h3>
      <p>{project.members.map((m) => m.user.name).join(", ") || "No one is on this project yet."}</p>
      {manage && (
        <form
          className="inline-add"
          onSubmit={async (e) => {
            e.preventDefault();
            setFormError("");
            if (!addUserId) return;
            try {
              await api(`/projects/${id}/members`, { method: "POST", body: { userId: Number(addUserId) } });
              setAddUserId("");
              await reload();
            } catch (err) {
              setFormError(err.message);
            }
          }}
        >
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            onFocus={async () => {
              if (users.length === 0) setUsers(await api("/users").catch(() => []));
            }}
          >
            <option value="">Add a person...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button type="submit">Add to project</button>
        </form>
      )}

      <h3>All tasks</h3>
      <p className="muted">
        Status and hours for the whole team.
        {manage ? " You assign work here." : " You can only change a task assigned to you."}
        {" "}Hours go on the <a href="#/log">Log time</a> tab.
      </p>
      {manage && (
        <form
          className="inline-add"
          onSubmit={async (e) => {
            e.preventDefault();
            setFormError("");
            if (!taskTitle.trim()) return;
            try {
              await api(`/projects/${id}/tasks`, {
                method: "POST",
                body: {
                  title: taskTitle.trim(),
                  assigneeId: taskAssignee ? Number(taskAssignee) : undefined,
                },
              });
              setTaskTitle("");
              setTaskAssignee("");
              await reload();
            } catch (err) {
              setFormError(err.message);
            }
          }}
        >
          <input
            type="text"
            placeholder="New task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
            <option value="">Assign to...</option>
            {project.members.map((m) => (
              <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
            ))}
          </select>
          <button type="submit">Add and assign</button>
        </form>
      )}

      {project.tasks.length === 0 ? (
        <p className="muted">No tasks yet.{manage ? " Add the first task and assign it." : " Wait for your manager to assign work."}</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assigned to</th>
                <th>Status</th>
                <th className="right">Hours logged</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {project.tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    {manage && editingTask?.id === t.id ? (
                      <input
                        value={editingTask.title}
                        onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                      />
                    ) : (
                      t.title
                    )}
                  </td>
                  <td>
                    {manage ? (
                      <select
                        value={t.assigneeId ?? ""}
                        onChange={(e) => patchTask(t.id, { assigneeId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Unassigned</option>
                        {project.members.map((m) => (
                          <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                        ))}
                      </select>
                    ) : (
                      t.assignee?.name || "Unassigned"
                    )}
                  </td>
                  <td>
                    {manage || t.assigneeId === user?.id ? (
                      <select value={t.status} onChange={(e) => patchTask(t.id, { status: e.target.value })}>
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    ) : (
                      TASK_STATUS[t.status] || t.status
                    )}
                  </td>
                  <td className="right">{num(t.loggedHours)}h</td>
                  <td>
                    {manage && editingTask?.id === t.id ? (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await patchTask(t.id, { title: editingTask.title });
                            setEditingTask(null);
                          }}
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingTask(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        {manage && (
                          <>
                            <button type="button" onClick={() => setEditingTask({ id: t.id, title: t.title })}>Edit</button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Delete task “${t.title}”?`)) return;
                                setFormError("");
                                try {
                                  await api(`/tasks/${t.id}`, { method: "DELETE" });
                                  await reload();
                                } catch (err) {
                                  setFormError(err.message);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {t.assigneeId === user?.id && (
                          <a
                            href="#/log"
                            onClick={() => localStorage.setItem("lastTaskId", String(t.id))}
                          >
                            Log time
                          </a>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
