import { useEffect, useState } from "react";
import { api } from "./api";

function spokenLine(c) {
  if (!c.lastSpokenAt) return "No conversation logged yet.";
  const when = new Date(c.lastSpokenAt).toLocaleDateString("en-IN");
  const who = c.lastSpokenBy?.name ? ` by ${c.lastSpokenBy.name}` : "";
  const note = c.lastSpokenNote ? ` — ${c.lastSpokenNote}` : "";
  return `Last spoke ${when}${who}${note}`;
}

export default function AccountDetail({ id }) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mailNotice, setMailNotice] = useState("");

  function load() {
    api(`/accounts/${id}`).then(setAccount).catch((e) => setError(e.message));
  }

  useEffect(() => {
    setAccount(null);
    setError("");
    load();
  }, [id]);

  async function addContact(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api(`/accounts/${id}/contacts`, { method: "POST", body: { name, email, phone } });
      setName(""); setEmail(""); setPhone("");
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function logSpoke(contactId, sendEmail) {
    setFormError("");
    setMailNotice("");
    try {
      const result = await api(`/accounts/${id}/contacts/${contactId}/spoke`, {
        method: "POST",
        body: { note, email: !!sendEmail },
      });
      setNote("");
      if (result.sent) {
        setMailNotice(
          result.sent.via === "smtp"
            ? `Follow-up emailed to ${result.sent.toName} (${result.sent.to}).`
            : `Follow-up saved for ${result.sent.toName} (${result.sent.to}). Add SMTP in the server .env to send through a real mailbox.`,
        );
      }
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function saveEdit(contactId) {
    setFormError("");
    try {
      await api(`/accounts/${id}/contacts/${contactId}`, {
        method: "PATCH",
        body: { name: editing.name, email: editing.email, phone: editing.phone },
      });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    setFormError("");
    try {
      await api(`/accounts/${id}/contacts/${c.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (error) return <><a href="#/accounts" className="back">← Accounts</a><p className="error" role="alert">{error}</p></>;
  if (!account) return <p className="muted">Loading company...</p>;

  return (
    <>
      <a href="#/accounts" className="back">← Accounts</a>
      <h2 className="title">{account.name}</h2>
      <p className="muted">{account.industry || "No industry set"}</p>

      <h3>Who we spoke to</h3>
      <form className="form inline" onSubmit={addContact} noValidate>
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-phone">Phone (optional)</label>
          <input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="primary" type="submit" disabled={saving}>{saving ? "Adding..." : "Add contact"}</button>
      </form>

      <div className="field" style={{ maxWidth: 420, marginBottom: 12 }}>
        <label htmlFor="spoke-note">Note for next “we spoke” log</label>
        <input id="spoke-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sent proposal, waiting on CFO" />
      </div>
      {formError && <p className="error" role="alert">{formError}</p>}
      {mailNotice && <p className="success" role="status">✓ {mailNotice}</p>}

      {account.contacts.length === 0 ? (
        <p className="muted">No contacts yet. Add the person Priya actually spoke to.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Last conversation</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {account.contacts.map((c) => (
                <tr key={c.id}>
                  {editing?.id === c.id ? (
                    <>
                      <td><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></td>
                      <td><input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></td>
                      <td>{spokenLine(c)}</td>
                      <td>
                        <button type="button" onClick={() => saveEdit(c.id)}>Save</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{c.name}</td>
                      <td>{c.email}</td>
                      <td>{spokenLine(c)}</td>
                      <td>
                        <button type="button" onClick={() => logSpoke(c.id, false)}>We spoke</button>
                        <button type="button" onClick={() => logSpoke(c.id, true)}>Email follow-up</button>
                        <button type="button" onClick={() => setEditing({ id: c.id, name: c.name, email: c.email, phone: c.phone || "" })}>Edit</button>
                        <button type="button" onClick={() => remove(c)}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Deals</h3>
      {account.deals.length === 0 ? (
        <p className="muted">No deals at this company yet.</p>
      ) : (
        <ul>
          {account.deals.map((d) => (
            <li key={d.id}><a href={`#/deals/${d.id}`}>{d.title}</a> · {d.stage}{d.contact ? ` · ${d.contact.name}` : ""}</li>
          ))}
        </ul>
      )}
    </>
  );
}
