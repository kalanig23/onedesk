import { useEffect, useState } from "react";
import { api, getUserId } from "./api";
import { num } from "./format";

// Local date (YYYY-MM-DD). toISOString() UTC deta hai, jo subah 5:30 se pehle kal ki date ho jati hai
const today = () => new Date().toLocaleDateString("en-CA");
const QUICK_HOURS = [1, 2, 4, 6, 8];

function taskLabel(projects, id) {
  for (const p of projects) {
    const t = p.tasks.find((x) => String(x.id) === String(id));
    if (t) return `${t.title} (${p.name})`;
  }
  return "";
}

export default function LogTime() {
  const userId = getUserId();
  const [projects, setProjects] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [taskId, setTaskId] = useState(localStorage.getItem("lastTaskId") || "");
  const [date, setDate] = useState(today());
  const [hours, setHours] = useState("");
  const [billable, setBillable] = useState(true);
  const [note, setNote] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    api("/time-entries/options")
      .then((p) => {
        setProjects(p);
        const ids = p.flatMap((x) => x.tasks.map((t) => String(t.id)));
        setTaskId((cur) => (ids.includes(cur) ? cur : ""));
      })
      .catch((e) => setLoadError(e.message));
    api("/time-entries/mine").then(setEntries).catch(() => {});
  }, [userId]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!taskId) return setError("Choose a task first.");
    if (!hours) return setError("Enter how many hours you worked.");

    setSaving(true);
    try {
      await api("/time-entries", {
        method: "POST",
        body: { taskId: Number(taskId), date, hours: Number(hours), billable, note },
      });
      localStorage.setItem("lastTaskId", taskId);
      setSuccess(`Saved ${hours}h on ${taskLabel(projects, taskId)}.`);
      setHours("");
      setNote("");
      setEntries(await api("/time-entries/mine"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return (
      <>
        <h2>Log time</h2>
        <p className="error" role="alert">Choose who you are from the menu at the top first.</p>
      </>
    );
  }
  if (loadError) return <><h2>Log time</h2><p className="error" role="alert">{loadError}</p></>;
  if (!projects) return <><h2>Log time</h2><p className="muted" aria-live="polite">Loading your projects...</p></>;
  if (projects.length === 0) {
    return (
      <>
        <h2>Log time</h2>
        <p className="muted">You are not on any active project yet. Ask your manager to add you to one.</p>
      </>
    );
  }

  const dayTotal = entries
    .filter((x) => x.date.slice(0, 10) === date)
    .reduce((sum, x) => sum + x.hours, 0);

  return (
    <>
      <h2>Log time</h2>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="task">Task</label>
          <select id="task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Choose a task</option>
            {projects.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          <p className="muted">Already logged on this day: {num(dayTotal)}h (limit 24h)</p>
        </div>

        <div className="field">
          <label htmlFor="hours">Hours</label>
          <input
            id="hours" type="number" inputMode="decimal" step="0.25"
            value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 4"
          />
          <div className="quick">
            {QUICK_HOURS.map((h) => (
              <button
                key={h} type="button" aria-pressed={String(h) === String(hours)}
                onClick={() => setHours(String(h))}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <div className="field check">
          <input id="billable" type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          <label htmlFor="billable">Billable to the client</label>
        </div>

        <div className="field">
          <label htmlFor="note">Note (optional)</label>
          <input id="note" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {success && <p className="success" role="status">✓ {success}</p>}

        <button className="primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </form>

      <h3>My recent entries</h3>
      {entries.length === 0 ? (
        <p className="muted">Nothing logged in the last 30 days. Your first entry will show up here.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Date</th><th>Task</th><th>Project</th><th className="right">Hours</th><th>Type</th></tr>
            </thead>
            <tbody>
              {entries.slice(0, 10).map((x) => (
                <tr key={x.id}>
                  <td>{x.date.slice(0, 10)}</td>
                  <td>{x.task.title}</td>
                  <td>{x.task.project.name}</td>
                  <td className="right">{num(x.hours)}h</td>
                  <td>{x.billable ? "Billable" : "Non-billable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}