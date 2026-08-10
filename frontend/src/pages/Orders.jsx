import { useEffect, useRef, useState } from "react";
import { Plus, Check, X, Trash2, Undo2, FileText, Printer, ScanLine } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const EMPTY_LINE = { productId: "", qty: "" };

function formatDate(value) {
  if (!value) return "—";
  // Handles both plain "YYYY-MM-DD" strings and full ISO timestamps
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function documentTitle(status) {
  if (status === "successful") return "Sales Receipt";
  if (status === "returned") return "Return Receipt";
  return "Sales Invoice";
}

export default function Orders() {
  const { user } = useAuth();
  const canManage =
    user.role === "admin" || user.role === "sales_staff" || user.role === "inventory_staff";

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [docOpen, setDocOpen] = useState(false);
  const [docTarget, setDocTarget] = useState(null);

  const [customerId, setCustomerId] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState("");
  const scanInputRef = useRef(null);

  async function load() {
    try {
      const [orderList, inventory, customerList] = await Promise.all([
        api.getOrders(),
        api.getInventory({}),
        api.getCustomers({}),
      ]);
      setOrders(orderList);
      setProducts(inventory);
      setCustomers(customerList);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNewOrder() {
    setCustomerId("");
    setHandoverDate("");
    setLines([{ ...EMPTY_LINE }]);
    setScanCode("");
    setScanError("");
    setNewOrderOpen(true);
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 100);
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

  /** Adds a scanned product to the order lines, or bumps its qty by 1 if it's already there */
  function addOrIncrementLine(product) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => String(l.productId) === String(product.id));
      if (idx >= 0) {
        const next = [...prev];
        const currentQty = Number(next[idx].qty) || 0;
        next[idx] = { ...next[idx], qty: currentQty + 1 };
        return next;
      }
      // Fill the first line instead of appending if it's still empty
      if (prev.length === 1 && !prev[0].productId) {
        return [{ productId: product.id, qty: 1 }];
      }
      return [...prev, { productId: product.id, qty: 1 }];
    });
  }

  async function handleScanAdd(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return;

    // The T1902L can also emit QR payloads that decode to JSON — unwrap those
    let code = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.code) code = parsed.code;
    } catch {
      // plain barcode/code, not JSON
    }

    setScanError("");
    try {
      const product = await api.lookupCode(code);
      // Make sure the scanned product has a matching <option> in the dropdown
      setProducts((prev) =>
        prev.some((p) => p.id === product.id) ? prev : [...prev, { ...product, available: product.stock }]
      );
      addOrIncrementLine(product);
      setScanCode("");
    } catch (err) {
      setScanError(err.message);
    } finally {
      scanInputRef.current?.focus();
    }
  }

  function handleScanKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleScanAdd(scanCode);
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setError("");

    if (!customerId) {
      setError("Please choose a customer.");
      return;
    }
    const selectedCustomer = customers.find((c) => String(c.id) === String(customerId));
    if (!selectedCustomer) {
      setError("Please choose a valid customer.");
      return;
    }
    if (!handoverDate) {
      setError("Please enter a handover date.");
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
        customer: selectedCustomer.name,
        customerId: selectedCustomer.id,
        handoverDate,
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

  function openReturn(order) {
    setReturnTarget(order);
    setReturnReason("");
    setError("");
    setReturnOpen(true);
  }

  async function handleConfirmReturn(e) {
    e.preventDefault();
    if (!returnTarget) return;
    if (!returnReason.trim()) {
      setError("Please provide a reason for the return.");
      return;
    }
    setError("");
    try {
      await api.returnOrder(returnTarget.id, returnReason.trim());
      setReturnOpen(false);
      setReturnTarget(null);
      setReturnReason("");
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

  function openDocument(order) {
    setDocTarget(order);
    setDocOpen(true);
  }

  function productLabel(p) {
    return `${p.name} (Available: ${p.available})`;
  }

  const documentableStatuses = ["pending", "successful", "returned"];

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
              <th>Handover Date</th>
              <th>Date Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: "center" }}>
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
                      <td rowSpan={orderLines.length}>{formatDate(order.handoverDate)}</td>
                      <td rowSpan={orderLines.length}>{created}</td>
                      <td rowSpan={orderLines.length}>
                        <span className={`status-badge status-${order.status}`}>
                          {order.status}
                        </span>
                      </td>
                      <td rowSpan={orderLines.length}>
                        <div className="row-actions">
                          {documentableStatuses.includes(order.status) && (
                            <button
                              className="icon-btn icon-btn-neutral"
                              title={`View ${documentTitle(order.status)}`}
                              onClick={() => openDocument(order)}
                            >
                              <FileText size={16} />
                            </button>
                          )}
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
                              onClick={() => openReturn(order)}
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
        <Modal title="Create New Order" onClose={() => setNewOrderOpen(false)} order>
          <form onSubmit={handleCreateOrder} className="modal-form">
            <div className="form-row">
              <label>
                Customer
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">-- Choose customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Handover Date
                <input
                  type="date"
                  required
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                />
              </label>
            </div>
            {customers.length === 0 && (
              <p className="muted" style={{ margin: 0 }}>
                No customers yet — add one on the Customers tab first.
              </p>
            )}
            <label>
              Scan to add product
              <div className="manual-lookup">
                <input
                  ref={scanInputRef}
                  placeholder="Scan a product QR/barcode…"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                />
                <button type="button" className="btn btn-secondary" onClick={() => handleScanAdd(scanCode)}>
                  <ScanLine size={16} /> Add
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
        </Modal>
      )}

      {deleteOpen && deleteTarget && (
        <Modal title="Delete Order" onClose={() => setDeleteOpen(false)} small>
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
        </Modal>
      )}

      {returnOpen && returnTarget && (
        <Modal title="Process Return" onClose={() => setReturnOpen(false)} small>
          <form onSubmit={handleConfirmReturn} className="modal-form">
            <p className="delete-msg">
              Restocking items from the order for <strong>{returnTarget.customer}</strong>.
            </p>
            <label>
              Reason for return
              <textarea
                required
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Wrong item, customer changed mind, damaged goods…"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setReturnOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger">
                Confirm Return
              </button>
            </div>
          </form>
        </Modal>
      )}

      {docOpen && docTarget && (
        <Modal title={documentTitle(docTarget.status)} onClose={() => setDocOpen(false)} wide>
          <div className="doc-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
          </div>
          <OrderDocument order={docTarget} />
        </Modal>
      )}
    </div>
  );
}

function OrderDocument({ order }) {
  const lines = order.products && order.products.length ? order.products : [];
  const title = documentTitle(order.status);

  return (
    <div className="printable-doc">
      <div className="doc-header">
        <div className="logo-mighty">MIGHTY CLEAN</div>
        <h2>{title}</h2>
      </div>
      <div className="doc-meta">
        <div>
          <strong>Order #</strong>
          {order.displayNumber || order.id}
        </div>
        <div>
          <strong>Status</strong>
          {order.status}
        </div>
        <div>
          <strong>Customer</strong>
          {order.customer}
        </div>
        <div>
          <strong>Handover Date</strong>
          {formatDate(order.handoverDate)}
        </div>
        <div>
          <strong>Date Created</strong>
          {formatDateTime(order.createdAt)}
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Cost</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td>{line.name}</td>
              <td>{line.qty}</td>
              <td>₱{Number(line.cost).toFixed(2)}</td>
              <td>₱{(Number(line.cost) * Number(line.qty)).toFixed(2)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "center" }}>
                No line items.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="doc-total-row">Total: ₱{Number(order.totalCost).toFixed(2)}</div>

      {order.status === "returned" && (
        <div className="doc-reason">
          <strong>Reason for Return</strong>
          <p>{order.returnReason || "—"}</p>
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide, small, order }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${wide ? " modal-wide" : ""}${small ? " modal-sm" : ""}${
          order ? " modal-order" : ""
        }`}
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