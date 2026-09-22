import { useEffect, useState } from "react";
import { api } from "./api";

export default function Accounts() {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    api("/accounts").then(setAccounts).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api("/accounts", {
        method: "POST",
        body: {
          name,
          industry,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        },
      });
      setName("");
      setIndustry("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id) {
    setFormError("");
    try {
      await api(`/accounts/${id}`, { method: "PATCH", body: { name: editing.name, industry: editing.industry } });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(a) {
    const extra = a._count.projects
      ? ` This will also delete ${a._count.projects} project(s), deals, contacts and logged hours.`
      : "";
    if (!window.confirm(`Delete ${a.name}?${extra} This cannot be undone.`)) return;
    setFormError("");
    try {
      await api(`/accounts/${a.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function archive(a) {
    if (!window.confirm(`Hide ${a.name} from the list? Delivery history stays in the database.`)) return;
    setFormError("");
    try {
      await api(`/accounts/${a.id}/archive`, { method: "POST" });
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;

  return (
    <>
      <h2>Accounts</h2>
      <p className="muted">Add the company and the person Priya spoke to. That person then shows up in Deals → Spoke to.</p>
      <form className="form inline" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="acc-name">Company name</label>
          <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-industry">Industry (optional)</label>
          <input id="acc-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-contact-name">Spoke to (name)</label>
          <input id="acc-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-contact-email">Spoke to (email)</label>
          <input id="acc-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-contact-phone">Phone (optional)</label>
          <input id="acc-contact-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        {formError && <p className="error" role="alert">{formError}</p>}
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add account"}
        </button>
      </form>

      {!accounts ? (
        <p className="muted">Loading accounts...</p>
      ) : accounts.length === 0 ? (
        <p className="muted">No accounts yet. Add your first client above.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Industry</th>
                <th className="right">Contacts</th><th className="right">Deals</th>
                <th className="right">Projects</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  {editing?.id === a.id ? (
                    <>
                      <td><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></td>
                      <td><input value={editing.industry} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} /></td>
                      <td className="right">{a._count.contacts}</td>
                      <td className="right">{a._count.deals}</td>
                      <td className="right">{a._count.projects}</td>
                      <td>
                        <button type="button" onClick={() => saveEdit(a.id)}>Save</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><a href={`#/accounts/${a.id}`}>{a.name}</a></td>
                      <td>{a.industry || "—"}</td>
                      <td className="right">{a._count.contacts}</td>
                      <td className="right">{a._count.deals}</td>
                      <td className="right">{a._count.projects}</td>
                      <td>
                        <button type="button" onClick={() => setEditing({ id: a.id, name: a.name, industry: a.industry || "" })}>Edit</button>
                        <button type="button" onClick={() => archive(a)}>Archive</button>
                        <button type="button" onClick={() => remove(a)}>Delete</button>
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
