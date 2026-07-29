import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, QrCode, Search, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const EMPTY_FORM = { code: "", name: "", category: "", cost: "", price: "", stock: "", lowStockThreshold: 5 };

export default function Inventory() {
  const { user } = useAuth();
  const canEdit = user.role === "admin" || user.role === "inventory_staff";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [qrModal, setQrModal] = useState(null); // { name, dataUrl }

  async function load() {
    try {
      const [items, cats] = await Promise.all([
        api.getInventory({ search, category }),
        api.getCategories(),
      ]);
      setProducts(items);
      setCategories(cats);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  function openAdd() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      code: product.code,
      name: product.name,
      category: product.category,
      cost: product.cost,
      price: product.price,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        cost: Number(form.cost),
        price: Number(form.price),
        stock: Number(form.stock),
        lowStockThreshold: Number(form.lowStockThreshold) || 5,
      };
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    try {
      await api.deleteProduct(product.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleShowQr(product) {
    try {
      const { dataUrl } = await api.getQrCode(product.id);
      setQrModal({ name: product.name, code: product.code, dataUrl });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="inventory-header">
        <h1>Inventory</h1>
        <div className="inventory-controls">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>All Categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {canEdit && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Cost</th>
              <th>Selling Price</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="muted">#{p.code}</td>
                <td className="cell-strong">{p.name}</td>
                <td>{p.category}</td>
                <td>₱{Number(p.cost).toFixed(2)}</td>
                <td>₱{Number(p.price).toFixed(2)}</td>
                <td>
                  <span className={p.isLow ? "stock-low" : "stock-ok"}>
                    {p.stock}
                    {p.isLow && " (LOW)"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn icon-btn-neutral" title="View QR code" onClick={() => handleShowQr(p)}>
                      <QrCode size={16} />
                    </button>
                    {canEdit && (
                      <>
                        <button className="icon-btn icon-btn-blue" title="Edit" onClick={() => openEdit(p)}>
                          <Pencil size={16} />
                        </button>
                        <button className="icon-btn icon-btn-red" title="Delete" onClick={() => handleDelete(p)}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center" }}>
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editingProduct ? "Edit product" : "Add product"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="modal-form">
            <label>
              Product code
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Category
              <input
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Cost
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </label>
              <label>
                Selling price
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Stock
                <input
                  type="number"
                  required
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </label>
              <label>
                Low stock threshold
                <input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-block">
              {editingProduct ? "Save changes" : "Add product"}
            </button>
          </form>
        </Modal>
      )}

      {qrModal && (
        <Modal title={qrModal.name} onClose={() => setQrModal(null)}>
          <div className="qr-modal">
            <img src={qrModal.dataUrl} alt={`QR code for ${qrModal.name}`} width={220} height={220} />
            <p className="muted">Code: {qrModal.code}</p>
            <a className="btn btn-secondary" href={qrModal.dataUrl} download={`qr-${qrModal.code}.png`}>
              Download QR
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
