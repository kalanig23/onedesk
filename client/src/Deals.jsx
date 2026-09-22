import { useEffect, useState } from "react";
import { api } from "./api";
import { rupees, num } from "./format";

const LABEL = { new: "New", qualified: "Qualified", proposal_sent: "Proposal Sent", won: "Won", lost: "Lost" };

function AddDealForm({ accounts, onAdded }) {
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [days, setDays] = useState("");
  const [close, setClose] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  const selected = accounts.find((a) => String(a.id) === String(accountId));
  const contacts = selected?.contacts || [];

  useEffect(() => {
    setContactId("");
    setNewName("");
    setNewEmail("");
  }, [accountId]);

  async function addPerson(e) {
    e.preventDefault();
    if (!accountId) return;
    setError("");
    setAddingPerson(true);
    try {
      const created = await api(`/accounts/${accountId}/contacts`, {
        method: "POST",
        body: { name: newName, email: newEmail },
      });
      setNewName("");
      setNewEmail("");
      setContactId(String(created.id));
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingPerson(false);
    }
  }

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
          contactId: contactId ? Number(contactId) : undefined,
        },
      });
      setTitle(""); setValue(""); setDays(""); setClose(""); setContactId("");
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="form inline" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="deal-account">Company</label>
          <select id="deal-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Choose a company</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="deal-contact">Spoke to</label>
          <select id="deal-contact" value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!accountId || contacts.length === 0}>
            <option value="">
              {!accountId ? "Pick a company first" : contacts.length === 0 ? "No one added yet" : "Choose a person"}
            </option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="deal-title">Deal title</label>
          <input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="deal-value">Rough value (₹)</label>
          <input id="deal-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="deal-days">Rough days</label>
          <input id="deal-days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="deal-close">Expected close</label>
          <input id="deal-close" type="date" value={close} onChange={(e) => setClose(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="primary" type="submit" disabled={saving}>{saving ? "Adding..." : "Add deal"}</button>
        </div>
      </form>
      {accountId && contacts.length === 0 && (
        <form className="form inline" onSubmit={addPerson} noValidate>
          <p className="muted">This company has no contacts. Add the person Priya spoke to, then they appear in Spoke to.</p>
          <div className="field">
            <label htmlFor="quick-name">Name</label>
            <input id="quick-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="quick-email">Email</label>
            <input id="quick-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="primary" type="submit" disabled={addingPerson}>{addingPerson ? "Adding..." : "Add person"}</button>
          </div>
        </form>
      )}
    </>
  );
}

export default function Deals() {
  const [deals, setDeals] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");
  const [editing, setEditing] = useState(null);

  function load() {
    api("/deals").then(setDeals).catch((e) => setError(e.message));
    api("/accounts").then(setAccounts).catch(() => {});
  }

  useEffect(load, []);

  async function saveEdit(id) {
    setRowError("");
    try {
      await api(`/deals/${id}`, {
        method: "PATCH",
        body: {
          title: editing.title,
          expectedValue: Number(editing.expectedValue),
          expectedDays: Number(editing.expectedDays),
          expectedCloseDate: editing.expectedCloseDate,
        },
      });
      setEditing(null);
      load();
    } catch (err) {
      setRowError(err.message);
    }
  }

  async function remove(d) {
    if (!window.confirm(`Delete “${d.title}”? This cannot be undone.`)) return;
    setRowError("");
    try {
      await api(`/deals/${d.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError(err.message);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;

  return (
    <>
      <h2>Deals</h2>
      <p className="muted">Priya’s pipeline: company, who she spoke to, rough size, and stage.</p>
      {accounts.length === 0 ? (
        <p className="muted">Add an account first before creating a deal.</p>
      ) : (
        <section className="form-panel">
          <h3>New deal</h3>
          <p className="muted">Enter company, client, title, days and value once. That size is the proposal — you do not type it again.</p>
          <AddDealForm accounts={accounts} onAdded={load} />
        </section>
      )}
      {rowError && <p className="error" role="alert">{rowError}</p>}

      {!deals ? (
        <p className="muted">Loading deals...</p>
      ) : deals.length === 0 ? (
        <p className="muted">No deals yet. Add your first one above.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th><th>Company</th><th>Spoke to</th><th>Stage</th>
                <th className="right">Value</th><th className="right">Days</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  {editing?.id === d.id ? (
                    <>
                      <td><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></td>
                      <td>{d.account.name}</td>
                      <td>{d.contact?.name || "—"}</td>
                      <td><span className={`stage ${d.stage}`}>{LABEL[d.stage]}</span></td>
                      <td className="right"><input type="number" value={editing.expectedValue} onChange={(e) => setEditing({ ...editing, expectedValue: e.target.value })} /></td>
                      <td className="right"><input type="number" value={editing.expectedDays} onChange={(e) => setEditing({ ...editing, expectedDays: e.target.value })} /></td>
                      <td>
                        <input type="date" value={editing.expectedCloseDate} onChange={(e) => setEditing({ ...editing, expectedCloseDate: e.target.value })} />
                        <button type="button" onClick={() => saveEdit(d.id)}>Save</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><a href={`#/deals/${d.id}`}>{d.title}</a></td>
                      <td>{d.account.name}</td>
                      <td>{d.contact?.name || "—"}</td>
                      <td>
                        <span className={`stage ${d.stage}`}>{LABEL[d.stage]}</span>
                        {d.quiet ? <span className="badge warning"> Quiet</span> : null}
                      </td>
                      <td className="right">{rupees(d.expectedValue)}</td>
                      <td className="right">{num(d.expectedDays)}</td>
                      <td>
                        {d.stage === "won" ? (
                          <span className="muted">Handed to delivery</span>
                        ) : (
                          <>
                            <a href={`#/deals/${d.id}`}>Open</a>{" "}
                            <button type="button" onClick={() => setEditing({
                              id: d.id,
                              title: d.title,
                              expectedValue: d.expectedValue,
                              expectedDays: d.expectedDays,
                              expectedCloseDate: String(d.expectedCloseDate).slice(0, 10),
                            })}>Edit</button>
                            <button type="button" onClick={() => remove(d)}>Delete</button>
                          </>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
