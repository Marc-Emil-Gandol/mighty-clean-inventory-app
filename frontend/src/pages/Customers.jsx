import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Eye } from "lucide-react";
import { api } from "../api";

const EMPTY_FORM = { name: "", contact: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ordersTarget, setOrdersTarget] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);

  async function load() {
    try {
      setCustomers(await api.getCustomers({ search }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createCustomer(form);
      setAddOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEdit(customer) {
    setEditingCustomer(customer);
    setForm({ name: customer.name, contact: customer.contact || "" });
    setEditOpen(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.updateCustomer(editingCustomer.id, form);
      setEditOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError("");
    try {
      await api.deleteCustomer(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openCustomerOrders(customer) {
    setError("");
    setOrdersTarget(customer);
    try {
      setCustomerOrders(await api.getCustomerOrders(customer.id));
      setOrdersOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="inventory-header">
        <h1>Customers</h1>
        <div className="inventory-controls">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setForm(EMPTY_FORM);
              setAddOpen(true);
            }}
          >
            <Plus size={16} /> Add New Customer
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="cell-strong">{c.name}</td>
                <td className="muted">{c.contact || "—"}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-btn icon-btn-neutral"
                      title="View Customer's Orders"
                      onClick={() => openCustomerOrders(c)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="icon-btn icon-btn-blue"
                      title="Edit"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-btn icon-btn-red"
                      title="Delete"
                      onClick={() => {
                        setDeleteTarget(c);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="muted" style={{ textAlign: "center" }}>
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <Modal title="Add New Customer" onClose={() => setAddOpen(false)}>
          <form onSubmit={handleAdd} className="modal-form">
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Contact (phone/email)
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Customer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editOpen && (
        <Modal title="Edit Customer" onClose={() => setEditOpen(false)}>
          <form onSubmit={handleEdit} className="modal-form">
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Contact (phone/email)
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteOpen && deleteTarget && (
        <Modal title="Delete Customer" onClose={() => setDeleteOpen(false)} small>
          <p className="delete-msg">
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleConfirmDelete}>
              Delete
            </button>
          </div>
        </Modal>
      )}

      {ordersOpen && ordersTarget && (
        <Modal
          title={`Orders — ${ordersTarget.name}`}
          onClose={() => setOrdersOpen(false)}
          wide
        >
          {customerOrders.length === 0 ? (
            <p className="muted">No orders found for this customer.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Products</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {customerOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      {(order.products || [])
                        .map((line) => `${line.name} × ${line.qty}`)
                        .join(", ") || "—"}
                    </td>
                    <td>₱{Number(order.totalCost).toFixed(2)}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>{order.status}</span>
                    </td>
                    <td className="muted">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide, small }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${wide ? " modal-wide" : ""}${small ? " modal-sm" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn icon-btn-neutral" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}