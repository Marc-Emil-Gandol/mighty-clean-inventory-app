import { useState } from "react";
import { Printer } from "lucide-react";
import { api } from "../api";

export default function Reports() {
  const [tab, setTab] = useState("inventory");
  const [inventoryReport, setInventoryReport] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  async function loadInventoryReport() {
    setError("");
    try {
      setInventoryReport(await api.getInventoryReport());
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSalesReport() {
    setError("");
    try {
      setSalesReport(await api.getSalesReport({ from, to }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
        <p className="page-subtitle">Generate printable inventory and sales reports.</p>
      </div>

      <div className="tabs">
        <button className={tab === "inventory" ? "tab active" : "tab"} onClick={() => setTab("inventory")}>
          Inventory report
        </button>
        <button className={tab === "sales" ? "tab active" : "tab"} onClick={() => setTab("sales")}>
          Sales report
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {tab === "inventory" && (
        <div className="card no-print-margin">
          <div className="report-toolbar">
            <button className="btn btn-secondary" onClick={loadInventoryReport}>
              Generate report
            </button>
            {inventoryReport && (
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
            )}
          </div>

          {inventoryReport && (
            <div className="printable-report">
              <h2>Inventory Report</h2>
              <p className="muted">Generated {new Date(inventoryReport.generatedAt).toLocaleString()}</p>
              <p>
                {inventoryReport.totalProducts} products · Total cost value ₱
                {inventoryReport.totalValue.toLocaleString()}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Cost</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryReport.products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.code}</td>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>₱{p.cost.toFixed(2)}</td>
                      <td>₱{p.price.toFixed(2)}</td>
                      <td>{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "sales" && (
        <div className="card no-print-margin">
          <div className="report-toolbar">
            <label className="inline-label">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="inline-label">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button className="btn btn-secondary" onClick={loadSalesReport}>
              Generate report
            </button>
            {salesReport && (
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
            )}
          </div>

          {salesReport && (
            <div className="printable-report">
              <h2>Sales Report</h2>
              <p className="muted">Generated {new Date(salesReport.generatedAt).toLocaleString()}</p>
              <p className="muted" style={{ marginTop: -4 }}>
                Includes POS sales and completed Orders. Pending, cancelled, and returned orders are
                excluded.
              </p>
              <p>
                {salesReport.totalUnits} units sold · Total revenue ₱
                {salesReport.totalRevenue.toLocaleString()}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReport.sales.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.product_name}
                        {s.product_code ? ` (${s.product_code})` : ""}
                      </td>
                      <td className="muted">{s.customer_name || "—"}</td>
                      <td>{s.quantity}</td>
                      <td>₱{s.unit_price.toFixed(2)}</td>
                      <td>₱{s.total.toFixed(2)}</td>
                      <td className="muted">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {salesReport.sales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: "center" }}>
                        No sales in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
