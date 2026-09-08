import { useEffect, useRef, useState } from "react";
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
  const [scanError, setScanError] = useState("");
  const scanRef = useRef(null);

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
    setScanError("");
    setNewOrderOpen(true);
    setTimeout(() => {
      scanRef.current?.focus();
    }, 100);
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function updateLine(index, field, value) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function removeLine(index) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  // Scan a barcode/QR (USB scanner types the code then sends Enter) or type a
  // code manually and add it as an order line — same pattern as the Sales
  // page's scan-to-lookup flow.
  async function handleScanAdd(e) {
    e.preventDefault();
    setScanError("");

    const raw = scanRef.current.value.trim();
    if (!raw) return;

    let code = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.code) code = parsed.code;
    } catch {
      // plain code, not JSON — use as-is
    }

    try {
      const product = await api.lookupCode(code);

      setLines((prev) => {
        const existingIndex = prev.findIndex((l) => String(l.productId) === String(product.id));
        if (existingIndex !== -1) {
          const updated = [...prev];
          const currentQty = Number(updated[existingIndex].qty) || 0;
          updated[existingIndex] = { ...updated[existingIndex], qty: String(currentQty + 1) };
          return updated;
        }
        const newLine = { productId: String(product.id), qty: "1" };
        const emptyIndex = prev.findIndex((l) => !l.productId);
        if (emptyIndex !== -1) {
          const updated = [...prev];
          updated[emptyIndex] = newLine;
          return updated;
        }
        return [...prev, newLine];
      });

      scanRef.current.value = "";
      scanRef.current.focus();
    } catch (err) {
      setScanError(err.message);
    }
  }

  function handleScanKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleScanAdd(e);
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
                Scan or Enter Product Code
                <div className="manual-lookup">
                  <input
                    ref={scanRef}
                    placeholder="Scan barcode or type code…"
                    onKeyDown={handleScanKeyDown}
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleScanAdd}>
                    <ScanLine size={16} />
                    Add
                  </button>
                </div>
              </label>
              {scanError && <div className="form-error">{scanError}</div>}

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