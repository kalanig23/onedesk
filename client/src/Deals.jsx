import { useEffect, useState } from "react";
import { api } from "./api";

const STAGES = ["new", "qualified", "proposal_sent", "won", "lost"];
const LABEL = { new: "New", qualified: "Qualified", proposal_sent: "Proposal Sent", won: "Won", lost: "Lost" };

// Har stage se aage kya options hain, jaisa server bhi check karta hai
const NEXT = {
  new: ["qualified", "lost"],
  qualified: ["proposal_sent", "lost"],
  proposal_sent: ["won", "lost"],
  won: [],
  lost: [],
};

function AddDealForm({ accounts, onAdded }) {
  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [days, setDays] = useState("");
  const [close, setClose] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/deals", {
        method: "POST",
        body: {
          accountId: Number(accountId), title,
          expectedValue: Number(value), expectedDays: Number(days),
          expectedCloseDate: close,
        },
      });
      setTitle(""); setValue(""); setDays(""); setClose("");
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form inline" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="deal-account">Account</label>
        <select id="deal-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Choose an account</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="deal-title">Deal title</label>
        <input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="deal-value">Expected value (₹)</label>
        <input id="deal-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="deal-days">Expected days</label>
        <input id="deal-days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="deal-close">Expected close date</label>
        <input id="deal-close" type="date" value={close} onChange={(e) => setClose(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={saving}>{saving ? "Adding..." : "Add deal"}</button>
    </form>
  );
}

function DealRow({ deal, onChanged }) {
  const [lostReason, setLostReason] = useState("");
  const [askingLost, setAskingLost] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function move(stage, reason) {
    setError("");
    setBusy(true);
    try {
      await api(`/deals/${deal.id}/stage`, { method: "POST", body: { stage, lostReason: reason, version: deal.version } });
      setAskingLost(false);
      setLostReason("");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = NEXT[deal.stage];

  return (
    <tr>
      <td>{deal.title}</td>
      <td>{deal.account.name}</td>
      <td><span className={`stage ${deal.stage}`}>{LABEL[deal.stage]}</span></td>
      <td className="right">₹{deal.expectedValue.toLocaleString("en-IN")}</td>
      <td className="right">{deal.expectedDays}</td>
      <td>
        {options.length === 0 ? (
          deal.stage === "won" && deal.project ? (
            <a href={`#/projects/${deal.project.id}`}>View project →</a>
          ) : (
            <span className="muted">—</span>
          )
        ) : null}
        {options.map((next) =>
          next === "lost" ? (
            <button key={next} disabled={busy} onClick={() => setAskingLost(true)}>Mark Lost</button>
          ) : (
            <button key={next} disabled={busy} onClick={() => move(next)}>Move to {LABEL[next]}</button>
          )
        )}
        {askingLost && (
          <div className="lost-box">
            <input
              placeholder="Why was it lost?"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
            <button disabled={busy} onClick={() => move("lost", lostReason)}>Confirm</button>
            <button disabled={busy} onClick={() => setAskingLost(false)}>Cancel</button>
          </div>
        )}
        {error && <p className="error small" role="alert">{error}</p>}
      </td>
    </tr>
  );
}

export default function Deals() {
  const [deals, setDeals] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");

  function load() {
    api("/deals").then(setDeals).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api("/accounts").then(setAccounts).catch(() => {});
  }, []);

  if (error) return <p className="error" role="alert">{error}</p>;

  return (
    <>
      <h2>Deals</h2>
      {accounts.length === 0 ? (
        <p className="muted">Add an account first before creating a deal.</p>
      ) : (
        <AddDealForm accounts={accounts} onAdded={load} />
      )}

      {!deals ? (
        <p className="muted">Loading deals...</p>
      ) : deals.length === 0 ? (
        <p className="muted">No deals yet. Add your first one above.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Title</th><th>Account</th><th>Stage</th><th className="right">Value</th><th className="right">Days</th><th>Action</th></tr>
            </thead>
            <tbody>
              {deals.map((d) => <DealRow key={d.id} deal={d} onChanged={load} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}