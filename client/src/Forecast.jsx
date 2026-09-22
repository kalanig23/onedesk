import { useEffect, useState } from "react";
import { api } from "./api";
import { rupees } from "./format";

const LABEL = { new: "New", qualified: "Qualified", proposal_sent: "Proposal Sent", won: "Won", lost: "Lost" };

export default function Forecast() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");

  function load() {
    api("/deals/forecast").then(setData).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function remove(d) {
    if (!window.confirm(`Delete “${d.title}”?`)) return;
    setRowError("");
    try {
      await api(`/deals/${d.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError(err.message);
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!data) return <p className="muted">Loading forecast...</p>;

  return (
    <>
      <h2>Pipeline forecast</h2>
      <p className="muted">{data.quarter} — open and won deals whose expected close date falls in this period, weighted by stage.</p>

      <section className="hero ok" aria-label="Weighted pipeline">
        <p className="muted">Weighted forecast</p>
        <p className="big">{rupees(data.likely)}</p>
        <p className="muted">Unweighted pipeline this period: {rupees(data.unweighted)}</p>
      </section>

      {rowError && <p className="error" role="alert">{rowError}</p>}

      <h3>Likely to close</h3>
      {data.deals.length === 0 ? (
        <p className="muted">No deals are set to close in {data.quarter}.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Deal</th><th>Company</th><th>Spoke to</th><th>Stage</th>
                <th className="right">Value</th><th className="right">Weighted</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.deals.map((d) => (
                <tr key={d.id}>
                  <td><a href={`#/deals/${d.id}`}>{d.title}</a></td>
                  <td>{d.account.name}</td>
                  <td>{d.contact?.name || "—"}</td>
                  <td><span className={`stage ${d.stage}`}>{LABEL[d.stage]}</span></td>
                  <td className="right">{rupees(d.expectedValue)}</td>
                  <td className="right">{rupees(Math.round(d.expectedValue * ({ new: 0.1, qualified: 0.35, proposal_sent: 0.6, won: 1, lost: 0 }[d.stage] || 0)))}</td>
                  <td>
                    {d.stage === "won" ? (
                      <span className="muted">Handed to delivery</span>
                    ) : (
                      <>
                        <a href={`#/deals/${d.id}`}>Edit</a>{" "}
                        <button type="button" onClick={() => remove(d)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Gone quiet (no activity for 4 months)</h3>
      {data.quiet.length === 0 ? (
        <p className="muted">Nothing has gone quiet. Keep logging who you last spoke to.</p>
      ) : (
        <ul className="quiet-list">
          {data.quiet.map((d) => (
            <li key={d.id}>
              <a href={`#/deals/${d.id}`}>{d.title}</a> · {d.account.name}
              {d.contact ? ` · last person ${d.contact.name}` : " · no contact on the deal"}
              {d.quiet ? <span className="badge warning"> Quiet</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
