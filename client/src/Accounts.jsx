import { useEffect, useState } from "react";
import { api } from "./api";

export default function Accounts() {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api("/accounts").then(setAccounts).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api("/accounts", { method: "POST", body: { name, industry } });
      setName("");
      setIndustry("");
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;

  return (
    <>
      <h2>Accounts</h2>
      <form className="form inline" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="acc-name">Company name</label>
          <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-industry">Industry (optional)</label>
          <input id="acc-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
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
              <tr><th>Company</th><th>Industry</th><th className="right">Contacts</th><th className="right">Deals</th><th className="right">Projects</th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.industry || "—"}</td>
                  <td className="right">{a._count.contacts}</td>
                  <td className="right">{a._count.deals}</td>
                  <td className="right">{a._count.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}