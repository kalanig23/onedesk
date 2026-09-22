import { useEffect, useState } from "react";
import { api } from "./api";
import { rupees, num } from "./format";

const LABEL = { new: "New", qualified: "Qualified", proposal_sent: "Proposal Sent", won: "Won", lost: "Lost" };
const PIPELINE = ["new", "qualified", "proposal_sent", "won"];
const NEXT = {
  new: ["qualified", "lost"],
  qualified: ["proposal_sent", "lost"],
  proposal_sent: ["won", "lost"],
  won: [],
  lost: ["new"],
};

function StageTrack({ stage }) {
  if (stage === "lost") {
    return (
      <ol className="stage-track" aria-label="Deal stage">
        <li className="lost">Lost</li>
      </ol>
    );
  }
  const idx = PIPELINE.indexOf(stage);
  return (
    <ol className="stage-track" aria-label="Deal stage">
      {PIPELINE.map((s, i) => (
        <li key={s} className={s === stage ? "current" : i < idx ? "done" : ""}>{LABEL[s]}</li>
      ))}
    </ol>
  );
}

function priyaNext(stage, contactName) {
  const client = contactName || "the client";
  if (stage === "new") {
    return {
      title: "Priya’s next step",
      body: `Priya (sales) marks this Qualified when the lead is real. ${client} is only the person we spoke to — they do not move stages.`,
    };
  }
  if (stage === "qualified") {
    return {
      title: "Priya’s next step",
      body: `Priya writes the proposal, then emails it to ${client}. That email is what the client receives. Sending it marks the deal Proposal Sent.`,
    };
  }
  if (stage === "proposal_sent") {
    return {
      title: "Client reply (Priya records it)",
      body: `${client} does not log in. After they reply to the proposal, Priya records it here: Yes → Won (Ravi gets a project). No → Lost.`,
    };
  }
  if (stage === "won") {
    return { title: "Handed to delivery", body: "Priya is done. Ravi’s team delivers and logs time." };
  }
  return { title: "Lost", body: "If the client comes back, Priya reopens the deal as New." };
}

export default function DealDetail({ id }) {
  const [deal, setDeal] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("");
  const [rate, setRate] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [mailNotice, setMailNotice] = useState("");
  const [lastMail, setLastMail] = useState(null);
  const [showAddLine, setShowAddLine] = useState(false);

  async function load() {
    const d = await api(`/deals/${id}`);
    setDeal(d);
    const acc = await api(`/accounts/${d.accountId}`);
    setContacts(acc.contacts || []);
  }

  useEffect(() => {
    setDeal(null);
    setError("");
    load().catch((e) => setError(e.message));
  }, [id]);

  async function fillFromDeal() {
    setFormError("");
    try {
      const dailyRate = Math.max(1, Math.round(Number(deal.expectedValue) / Number(deal.expectedDays)));
      setDeal(await api(`/deals/${id}/proposal-items`, {
        method: "POST",
        body: { title: deal.title, estimatedDays: Number(deal.expectedDays), dailyRate },
      }));
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    setFormError("");
    try {
      setDeal(await api(`/deals/${id}/proposal-items`, {
        method: "POST",
        body: { title, estimatedDays: Number(days), dailyRate: Number(rate) },
      }));
      setTitle(""); setDays(""); setRate("");
      setShowAddLine(false);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function removeItem(itemId) {
    if (!window.confirm("Delete this work item?")) return;
    setFormError("");
    try {
      setDeal(await api(`/deals/${id}/proposal-items/${itemId}`, { method: "DELETE" }));
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function saveItem(itemId) {
    setFormError("");
    try {
      setDeal(await api(`/deals/${id}/proposal-items/${itemId}`, {
        method: "PATCH",
        body: {
          title: editingItem.title,
          estimatedDays: Number(editingItem.estimatedDays),
          dailyRate: Number(editingItem.dailyRate),
        },
      }));
      setEditingItem(null);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function setContact(contactId) {
    setFormError("");
    try {
      setDeal(await api(`/deals/${id}`, { method: "PATCH", body: { contactId: contactId || null } }));
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function move(stage, reason) {
    setFormError("");
    setBusy(true);
    try {
      await api(`/deals/${id}/stage`, { method: "POST", body: { stage, lostReason: reason, version: deal.version } });
      await load();
      setLostReason("");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendProposal() {
    setFormError("");
    setMailNotice("");
    setBusy(true);
    try {
      const result = await api(`/deals/${id}/send-proposal`, {
        method: "POST",
        body: { version: deal.version },
      });
      setLastMail(result.sent);
      setMailNotice(
        result.sent.via === "smtp"
          ? `Proposal emailed to ${result.sent.toName} (${result.sent.to}).`
          : `Proposal saved for ${result.sent.toName} (${result.sent.to}). Add SMTP in the server .env to send through a real mailbox.`,
      );
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <><a href="#/deals" className="back">← Deals</a><p className="error" role="alert">{error}</p></>;
  if (!deal) return <p className="muted">Loading deal...</p>;

  const options = NEXT[deal.stage] || [];
  const hint = priyaNext(deal.stage, deal.contact?.name);
  const last = deal.contact?.lastSpokenAt
    ? `${deal.contact.name} · ${new Date(deal.contact.lastSpokenAt).toLocaleDateString("en-IN")}${deal.contact.lastSpokenBy ? ` · ${deal.contact.lastSpokenBy.name}` : ""}`
    : (deal.contact?.name || "Nobody tagged yet");

  return (
    <>
      <a href="#/deals" className="back">← Deals</a>
      <h2 className="title">{deal.title}</h2>
      <p className="muted">
        <a href={`#/accounts/${deal.accountId}`}>{deal.account.name}</a>
        {deal.quiet ? <span className="badge warning"> Quiet for 4 months</span> : null}
      </p>
      <StageTrack stage={deal.stage} />
      <p>Rough size: {rupees(deal.expectedValue)} · {num(deal.expectedDays)} days · close {String(deal.expectedCloseDate).slice(0, 10)}</p>
      {deal.lostReason && <p>Lost reason: {deal.lostReason}</p>}

      <h3>Client (spoke to)</h3>
      <p className="muted">This is the person at the company. They receive mail. They do not click Qualified, Won or Lost.</p>
      <p className="muted">{last}{deal.contact?.lastSpokenNote ? ` — ${deal.contact.lastSpokenNote}` : ""}</p>
      {deal.contact?.email && <p className="muted">Mail goes to {deal.contact.email}</p>}
      {deal.stage !== "won" && (
        <div className="field" style={{ maxWidth: 280, marginBottom: 16 }}>
          <label htmlFor="deal-contact">Contact on this deal</label>
          <select id="deal-contact" value={deal.contactId || ""} onChange={(e) => setContact(e.target.value)}>
            <option value="">Not set</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </select>
        </div>
      )}
      <h3>Proposal</h3>
      <p className="muted">
        This is the same size you entered on the deal ({num(deal.expectedDays)} days · {rupees(deal.expectedValue)}).
        Split into extra lines only if the quote has more than one piece of work.
      </p>
      {deal.stage !== "won" && deal.stage !== "lost" && showAddLine && (
        <form className="form inline" onSubmit={addItem} noValidate>
          <div className="field">
            <label htmlFor="pi-title">Work item</label>
            <input id="pi-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pi-days">Days</label>
            <input id="pi-days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pi-rate">Daily rate (₹)</label>
            <input id="pi-rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">Add line</button>
            <button type="button" onClick={() => setShowAddLine(false)}>Cancel</button>
          </div>
        </form>
      )}
      {formError && <p className="error" role="alert">{formError}</p>}
      {mailNotice && <p className="success" role="status">✓ {mailNotice}</p>}
      {(lastMail || deal.emails?.[0]) && (
        <pre className="mail-preview">{(lastMail || deal.emails[0]).subject}{"\n\n"}{(lastMail || deal.emails[0]).bodyText}</pre>
      )}
      {deal.proposalItems.length === 0 ? (
        deal.stage !== "won" && deal.stage !== "lost" ? (
          <p className="muted">
            <button type="button" onClick={fillFromDeal}>Use the deal size as the proposal</button>
            {" "}({num(deal.expectedDays)} days · {rupees(deal.expectedValue)})
          </p>
        ) : (
          <p className="muted">No proposal lines.</p>
        )
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Item</th><th className="right">Days</th><th className="right">Daily rate</th><th className="right">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {deal.proposalItems.map((i) => (
                <tr key={i.id}>
                  {editingItem?.id === i.id ? (
                    <>
                      <td><input value={editingItem.title} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} /></td>
                      <td className="right"><input type="number" value={editingItem.estimatedDays} onChange={(e) => setEditingItem({ ...editingItem, estimatedDays: e.target.value })} /></td>
                      <td className="right"><input type="number" value={editingItem.dailyRate} onChange={(e) => setEditingItem({ ...editingItem, dailyRate: e.target.value })} /></td>
                      <td className="right">—</td>
                      <td>
                        <button type="button" onClick={() => saveItem(i.id)}>Save</button>
                        <button type="button" onClick={() => setEditingItem(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{i.title}</td>
                      <td className="right">{num(i.estimatedDays)}</td>
                      <td className="right">{rupees(i.dailyRate)}</td>
                      <td className="right">{rupees(i.estimatedDays * i.dailyRate)}</td>
                      <td>
                        {deal.stage !== "won" && deal.stage !== "lost" && (
                          <>
                            <button type="button" onClick={() => setEditingItem({
                              id: i.id, title: i.title, estimatedDays: i.estimatedDays, dailyRate: i.dailyRate,
                            })}>Edit</button>
                            <button type="button" onClick={() => removeItem(i.id)}>Delete</button>
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
      {deal.stage !== "won" && deal.stage !== "lost" && deal.proposalItems.length > 0 && !showAddLine && (
        <p>
          <button type="button" onClick={() => setShowAddLine(true)}>Add another work item</button>
        </p>
      )}

      <section className="action-box form-panel">
        <h3>{hint.title}</h3>
        <p className="muted">{hint.body}</p>
        {deal.stage === "proposal_sent" ? (
          <>
            <div className="inline-add">
              <button className="primary" type="button" disabled={busy} onClick={() => move("won")}>
                Client said yes — Won (hand to Ravi)
              </button>
            </div>
            <div className="lost-box">
              <input
                placeholder="If they said no, why?"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
              <button type="button" disabled={busy} onClick={() => move("lost", lostReason)}>
                Client said no — Lost
              </button>
            </div>
            <div className="inline-add">
              <button type="button" disabled={busy} onClick={sendProposal}>
                Resend proposal email to {deal.contact?.name || "the client"}
              </button>
            </div>
          </>
        ) : options.length === 0 ? (
          <p className="muted">This deal is closed on the sales side.</p>
        ) : (
          <div className="inline-add">
            {options.map((next) =>
              next === "lost" ? (
                <span key={next} className="lost-box">
                  <input placeholder="Why was it lost?" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
                  <button disabled={busy} onClick={() => move("lost", lostReason)}>Priya: mark Lost</button>
                </span>
              ) : next === "proposal_sent" ? (
                <button key={next} className="primary" disabled={busy} onClick={sendProposal}>
                  Priya: email proposal to {deal.contact?.name || "the client"}
                </button>
              ) : next === "qualified" ? (
                <button key={next} className="primary" disabled={busy} onClick={() => move("qualified")}>
                  Priya: mark Qualified
                </button>
              ) : next === "new" ? (
                <button key={next} disabled={busy} onClick={() => move("new")}>Priya: reopen as New</button>
              ) : (
                <button key={next} disabled={busy} onClick={() => move(next)}>Move to {LABEL[next]}</button>
              )
            )}
          </div>
        )}
      </section>
    </>
  );
}
