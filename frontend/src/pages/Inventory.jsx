import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  QrCode,
  Search,
  X,
  PackagePlus,
  Package,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "../components/Modal";

const EMPTY_PRODUCT = {
  code: "",
  name: "",
  category: "",
  cost: "",
  price: "",
  stock: "",
};

export default function Inventory() {
  const { user } = useAuth();
  const canEdit = user.role === "admin" || user.role === "inventory_staff";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [error, setError] = useState("");

  const [choiceOpen, setChoiceOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [damageOpen, setDamageOpen] = useState(false);
  const [damageTarget, setDamageTarget] = useState(null);
  const [damageForm, setDamageForm] = useState({ quantity: "", issue: "" });

  const [stockForm, setStockForm] = useState({ productId: "", quantity: "" });
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [codeLocked, setCodeLocked] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [localCategories, setLocalCategories] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    try {
      const [items, cats] = await Promise.all([
        api.getInventory({ search, category }),
        api.getCategories(),
      ]);
      setProducts(items);
      setCategories(cats);
      setLocalCategories((prev) => {
        const merged = [...new Set([...cats, ...prev])].sort();
        return merged;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  async function openAddProduct() {
    setChoiceOpen(false);
    setError("");
    try {
      const { code } = await api.getNextProductCode();
      setProductForm({ ...EMPTY_PRODUCT, code });
      setCodeLocked(true);
      setNewCategory("");
      setAddProductOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function openAddStock() {
    setChoiceOpen(false);
    setStockForm({ productId: "", quantity: "" });
    setAddStockOpen(true);
  }

  function handleAddCategory() {
    const val = newCategory.trim();
    if (!val) return;
    if (localCategories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    const updated = [...localCategories, val].sort();
    setLocalCategories(updated);
    setProductForm({ ...productForm, category: val });
    setNewCategory("");
  }

  async function handleAddStock(e) {
    e.preventDefault();
    setError("");
    try {
      await api.addStock(stockForm.productId, Number(stockForm.quantity));
      setAddStockOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createProduct({
        code: productForm.code.trim(),
        name: productForm.name.trim(),
        category: productForm.category,
        cost: Number(productForm.cost),
        price: Number(productForm.price) || Number(productForm.cost),
        stock: Number(productForm.stock),
      });
      setAddProductOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEdit(product) {
    setEditingProduct(product);
    setProductForm({
      code: product.code,
      name: product.name,
      category: product.category,
      cost: product.cost,
      price: product.price,
      stock: product.stock,
    });
    setEditOpen(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.updateProduct(editingProduct.id, {
        code: productForm.code,
        name: productForm.name.trim(),
        category: productForm.category,
        cost: Number(productForm.cost),
        price: Number(productForm.price) || Number(productForm.cost),
        stock: Number(productForm.stock),
      });
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
      await api.deleteProduct(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
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

  async function handleReportDamage(e) {
    e.preventDefault();
    setError("");
    try {
      await api.reportDamage(damageTarget.id, {
        quantity: Number(damageForm.quantity),
        issue: damageForm.issue.trim(),
      });
      setDamageOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const categoryOptions = [...new Set([...categories, ...localCategories])].sort();

  return (
    <div className="page">
      <div className="inventory-header">
        <h1>Inventory</h1>
        <div className="inventory-controls">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>All Categories</option>
            {categoryOptions.map((c) => (
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
            <button className="btn btn-primary" onClick={() => setChoiceOpen(true)}>
              <Plus size={16} /> Add Stock / Product
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card table-card">
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>In Stock</th>
              <th>Available</th>
              <th>Outgoing</th>
              <th>Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="muted">#{p.code}</td>
                <td className="cell-strong">{p.name}</td>
                <td>{p.category}</td>
                <td>
                  <span className={p.isLow ? "stock-low" : "stock-ok"}>
                    {p.stock}
                    {p.isLow && " (LOW)"}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      p.isCritical ? "stock-low" : p.isAvailableLow ? "stock-low" : "stock-ok"
                    }
                  >
                    {p.available}
                    {p.isCritical && " (CRITICAL)"}
                  </span>
                </td>
                <td>{p.outgoing}</td>
                <td>₱{Number(p.cost).toFixed(2)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-btn icon-btn-neutral"
                      title="View QR code"
                      onClick={() => handleShowQr(p)}
                    >
                      <QrCode size={16} />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          className="icon-btn icon-btn-blue"
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn icon-btn-amber"
                          title="Report Damage Item/s"
                          onClick={() => {
                            setDamageTarget(p);
                            setDamageForm({ quantity: "", issue: "" });
                            setDamageOpen(true);
                          }}
                        >
                          <AlertTriangle size={16} />
                        </button>
                        <button
                          className="icon-btn icon-btn-red"
                          title="Delete"
                          onClick={() => {
                            setDeleteTarget(p);
                            setDeleteOpen(true);
                          }}
                        >
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
                <td colSpan={8} className="muted" style={{ textAlign: "center" }}>
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {choiceOpen && (
        <Modal title="What would you like to do?" onClose={() => setChoiceOpen(false)}>
          <div className="choice-buttons">
            <button type="button" className="choice-btn" onClick={openAddStock}>
              <PackagePlus size={28} />
              <div>
                <span>Add Stock to Existing Product</span>
                <small>Increase quantity of a product already in the system</small>
              </div>
            </button>
            <button type="button" className="choice-btn" onClick={openAddProduct}>
              <Package size={28} />
              <div>
                <span>Add New Product</span>
                <small>Create a brand new product in the inventory</small>
              </div>
            </button>
          </div>
        </Modal>
      )}

      {addStockOpen && (
        <Modal title="Add Stock to Existing Product" onClose={() => setAddStockOpen(false)}>
          <form onSubmit={handleAddStock} className="modal-form">
            <label>
              Select Product
              <select
                required
                value={stockForm.productId}
                onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}
              >
                <option value="">-- Choose a product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current: {p.stock})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity to Add
              <input
                type="number"
                min={1}
                required
                placeholder="e.g. 50"
                value={stockForm.quantity}
                onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAddStockOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Stock
              </button>
            </div>
          </form>
        </Modal>
      )}

      {addProductOpen && (
        <Modal title="Add New Product" onClose={() => setAddProductOpen(false)} size="lg">
          <form onSubmit={handleAddProduct} className="modal-form">
            <label>
              Product Code
              <div className="code-input-row">
                <input
                  required
                  value={productForm.code}
                  readOnly={codeLocked}
                  onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title={codeLocked ? "Edit product code" : "Use auto-generated code"}
                  onClick={() => setCodeLocked((v) => !v)}
                >
                  <RefreshCw size={14} />
                  {codeLocked ? "Edit" : "Auto"}
                </button>
              </div>
            </label>
            <label>
              Product Name
              <input
                required
                placeholder="e.g. Fabcon Blue Bliss"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              />
            </label>
            <label>
              Category
              <select
                required
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              >
                <option value="">-- Select category --</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="new-category-row">
                <input
                  placeholder="Or type a new category…"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCategory}>
                  + Add
                </button>
              </div>
            </label>
            <div className="form-row">
              <label>
                Cost (₱)
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={productForm.cost}
                  onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                />
              </label>
              <label>
                Initial Stock
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAddProductOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Product
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editOpen && (
        <Modal title="Edit Product" onClose={() => setEditOpen(false)} size="lg">
          <form onSubmit={handleEdit} className="modal-form">
            <label>
              Product Name
              <input
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              />
            </label>
            <label>
              Category
              <select
                required
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Cost (₱)
                <input
                  type="number"
                  step="0.01"
                  required
                  value={productForm.cost}
                  onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                />
              </label>
              <label>
                Stock
                <input
                  type="number"
                  required
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                />
              </label>
            </div>
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

      {damageOpen && damageTarget && (
        <Modal title={`Report Damage — ${damageTarget.name}`} onClose={() => setDamageOpen(false)}>
          <form onSubmit={handleReportDamage} className="modal-form">
            <label>
              Quantity damaged
              <input
                type="number"
                min={1}
                max={damageTarget.stock}
                required
                value={damageForm.quantity}
                onChange={(e) => setDamageForm({ ...damageForm, quantity: e.target.value })}
              />
            </label>
            <label>
              What was the issue?
              <textarea
                required
                rows={3}
                placeholder="e.g. Torn packaging, leaked contents"
                value={damageForm.issue}
                onChange={(e) => setDamageForm({ ...damageForm, issue: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDamageOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger">
                Submit Damage Report
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteOpen && deleteTarget && (
        <Modal title="Delete Product" onClose={() => setDeleteOpen(false)} size="sm">
          <p className="delete-msg">
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot
            be undone.
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
