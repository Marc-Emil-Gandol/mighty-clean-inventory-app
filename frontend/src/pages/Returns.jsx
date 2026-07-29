import { useEffect, useState } from "react";
import { api } from "../api";

export default function Returns() {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [returns, setReturns] = useState([]);

  function load() {
    api.getReturns().then(setReturns).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const created = await api.recordReturn({ code: code.trim(), quantity: Number(quantity), reason });
      setMessage(`Return processed: ${quantity} unit(s) added back to stock`);
      setCode("");
      setQuantity(1);
      setReason("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Returns</h1>
        <p className="page-subtitle">Process a customer return and restock the item.</p>
      </div>

      <div className="panel-grid">
        <div className="card">
          <h2 className="card-title">Process a return</h2>
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          <form onSubmit={handleSubmit} className="modal-form">
            <label>
              Product code
              <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 1001" />
            </label>
            <label>
              Quantity
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label>
              Reason (optional)
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged packaging" />
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              Process return
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">Recent returns</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <td>{r.product_name}</td>
                  <td>{r.quantity}</td>
                  <td className="muted">{r.reason || "—"}</td>
                  <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center" }}>
                    No returns recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
