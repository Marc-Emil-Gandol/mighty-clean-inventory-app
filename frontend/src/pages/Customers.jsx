import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.getCustomers().then(setCustomers).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createCustomer({ name, contact });
      setName("");
      setContact("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Remove ${c.name}?`)) return;
    try {
      await api.deleteCustomer(c.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Customers</h1>
        <p className="page-subtitle">Keep a simple record of regular customers.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="panel-grid">
        <div className="card">
          <h2 className="card-title">
            <Plus size={16} /> Add customer
          </h2>
          <form onSubmit={handleSubmit} className="modal-form">
            <label>
              Name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Contact (phone/email)
              <input value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary btn-block">
              Add customer
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">Customer list</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="muted">{c.contact || "—"}</td>
                  <td>
                    <button className="icon-btn icon-btn-red" onClick={() => handleDelete(c)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: "center" }}>
                    No customers yet.
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
