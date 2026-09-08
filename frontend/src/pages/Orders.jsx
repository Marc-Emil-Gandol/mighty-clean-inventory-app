import { useEffect, useState, useRef } from "react";
import { Plus, Check, X, Trash2, Undo2, FileText, ScanLine } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PrintableReport } from "../components/PrintableReport";

const EMPTY_LINE = { productId: "", qty: "" };

function reportTypeForOrder(order) {
  if (order.status === "successful") return "sales_receipt";
  if (order.status === "returned") return "return_receipt";
  return "sales_invoice"; // pending or cancelled
}

function extractScannedCode(raw) {
  let code = String(raw || "").trim();
  if (!code) return "";
  try {
    const parsed = JSON.parse(code);
    if (parsed && parsed.code) code = parsed.code;
  } catch {
    // plain barcode/text, use as-is
  }
  return code;
}

export default function Orders() {
  const { user } = useAuth();
  const canManage =
    user.role === "admin" || user.role === "sales_staff" || user.role === "inventory_staff";

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);

  const [customer, setCustomer] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [scanValue, setScanValue] = useState("");
  const scanInputRef = useRef(null);

  async function load() {
    try {
      const [orderList, inventory] = await Promise.all([api.getOrders(), api.getInventory({})]);
      setOrders(orderList);
      setProducts(inventory);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNewOrder() {
    setCustomer("");
    setLines([{ ...EMPTY_LINE }]);
    setScanValue("");
    setNewOrderOpen(true);
  }

  function addLine() {
    setLines([...lines, { ...EMPTY_LINE }]);
  }

  function updateLine(index, field, value) {
    const next = lines.map((line, i) => (i === index ? { ...line, [field]: value } : line));
    setLines(next);
  }

  function removeLine(index) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  function applyScannedProduct(product) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => String(l.productId) === String(product.id));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: String(Number(next[idx].qty || 0) + 1) };
        return next;
      }
      const emptyIdx = prev.findIndex((l) => !l.productId);
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { productId: product.id, qty: "1" };
        return next;
      }
      return [...prev, { productId: product.id, qty: "1" }];
    });
  }

  async function handleScan(rawValue) {
    const code = extractScannedCode(rawValue);
    setScanValue("");
    if (!code) return;
    setError("");
    try {
      const p = await api.lookupCode(code);
      applyScannedProduct(p);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleScanKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleScan(e.target.value);
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setError("");

    if (!customer.trim()) {
      setError("Please enter a customer name.");
      return;
    }

    const productLines = [];
    for (const line of lines) {
      const product = products.find((p) => String(p.id) === String(line.productId));
      if (!product) {
        setError("Please choose a product for every line.");
        return;
      }
      const qty = Number(line.qty);
      if (!qty || qty < 1) {
        setError("Please enter a valid quantity for every line.");
        return;
      }
      productLines.push({
        productId: product.id,
        name: product.name,
        qty,
        cost: product.cost,
      });
    }

    try {
      await api.createOrder({
        customer: customer.trim(),
        products: productLines,
      });
      setNewOrderOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleComplete(id) {
    setError("");
    try {
      await api.completeOrder(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(id) {
    setError("");
    try {
      await api.cancelOrder(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReturn(id) {
    if (!confirm("Process this return and restock the items?")) return;
    setError("");
    try {
      await api.returnOrder(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError("");
    try {
      await api.deleteOrder(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function productLabel(p) {
    return `${p.name} (Available: ${p.available})`;
  }

  return (
    <div className="page">
      <div className="inventory-header">
        <h1>Orders</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={openNewOrder}>
            <Plus size={16} /> New Order
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card table-card">
        <table className="table orders-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Total Cost</th>
              <th>Date Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: "center" }}>
                  No orders found.
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const orderLines =
                order.products && order.products.length
                  ? order.products
                  : [{ name: "—", qty: 0 }];
              const created = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—";

              return orderLines.map((line, i) => (
                <tr key={`${order.id}-${i}`} className={i > 0 ? "order-line-subrow" : ""}>
                  {i === 0 && (
                    <>
                      <td rowSpan={orderLines.length} className="muted">
                        #{order.displayNumber || order.id}
                      </td>
                      <td rowSpan={orderLines.length} className="cell-strong">
                        {order.customer}
                      </td>
                    </>
                  )}
                  <td>{line.name}</td>
                  <td>{line.qty}</td>
                  {i === 0 && (
                    <>
                      <td rowSpan={orderLines.length}>₱{Number(order.totalCost).toFixed(2)}</td>
                      <td rowSpan={orderLines.length}>{created}</td>
                      <td rowSpan={orderLines.length}>
                        <span className={`status-badge status-${order.status}`}>
                          {order.status}
                        </span>
                      </td>
                      <td rowSpan={orderLines.length}>
                        <div className="row-actions">
                          <button
                            className="icon-btn icon-btn-neutral"
                            title="View printable report"
                            onClick={() => setPreviewOrder(order)}
                          >
                            <FileText size={16} />
                          </button>
                          {canManage && order.status === "pending" && (
                            <>
                              <button
                                className="icon-btn icon-btn-green"
                                title="Mark as Successful"
                                onClick={() => handleComplete(order.id)}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                className="icon-btn icon-btn-amber"
                                title="Cancel Order"
                                onClick={() => handleCancel(order.id)}
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          {canManage && order.status === "successful" && (
                            <button
                              className="icon-btn icon-btn-amber"
                              title="Process Return"
                              onClick={() => handleReturn(order.id)}
                            >
                              <Undo2 size={16} />
                            </button>
                          )}
                          {canManage && (
                            <button
                              className="icon-btn icon-btn-red"
                              title="Delete Order"
                              onClick={() => {
                                setDeleteTarget(order);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {newOrderOpen && (
        <div className="modal-overlay" onClick={() => setNewOrderOpen(false)}>
          <div className="modal modal-wide modal-order" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Order</h3>
              <button className="icon-btn icon-btn-neutral" onClick={() => setNewOrderOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="modal-form">
              <label>
                Customer Name
                <input
                  required
                  placeholder="e.g. Juan Dela Cruz"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </label>
              <label>
                Scan product (optional)
                <input
                  ref={scanInputRef}
                  placeholder="Scan with T-1902L scanner, or type the code and press Enter"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                />
              </label>
              <div className="order-products-header">
                <label>Products</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}>
                  + Add Product
                </button>
              </div>
              <div className="order-lines">
                {lines.map((line, index) => (
                  <div key={index} className="order-line">
                    <select
                      required
                      value={line.productId}
                      onChange={(e) => updateLine(index, "productId", e.target.value)}
                    >
                      <option value="">-- Choose product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {productLabel(p)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="Qty"
                      value={line.qty}
                      onChange={(e) => updateLine(index, "qty", e.target.value)}
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="btn-line-remove"
                        onClick={() => removeLine(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setNewOrderOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Order</h3>
              <button className="icon-btn icon-btn-neutral" onClick={() => setDeleteOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="delete-msg">
              Are you sure you want to delete the order for{" "}
              <strong>{deleteTarget.customer}</strong>? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOrder && (
        <PrintableReport
          type={reportTypeForOrder(previewOrder)}
          data={previewOrder}
          generatedBy={user.name}
          onClose={() => setPreviewOrder(null)}
        />
      )}
    </div>
  );
}