import { useState } from "react";
import { Printer } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DocHeader, SignatureLine } from "../components/PrintableReport";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function rangeFor(period) {
  const now = new Date();
  const to = toISODate(now);
  let from = to;
  if (period === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    from = toISODate(start);
  } else if (period === "monthly") {
    from = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  } else if (period === "yearly") {
    from = toISODate(new Date(now.getFullYear(), 0, 1));
  }
  return { from, to };
}

export default function Reports() {
  const { user } = useAuth();
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

  async function loadSalesReport(params) {
    setError("");
    try {
      setSalesReport(await api.getSalesReport(params || { from, to }));
    } catch (err) {
      setError(err.message);
    }
  }

  function generatePeriodReport(period) {
    const range = rangeFor(period);
    setFrom(range.from);
    setTo(range.to);
    loadSalesReport(range);
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
              <DocHeader
                title="Inventory Report"
                subtitle={`Generated ${new Date(inventoryReport.generatedAt).toLocaleString()}`}
              />
              <p>
                {inventoryReport.totalProducts} products · Total production cost value ₱
                {inventoryReport.totalValue.toLocaleString()}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Production Cost</th>
                    <th>Price</th>
                    <th>In Stock</th>
                    <th>Available Stock</th>
                    <th>Outgoing Stock</th>
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
                      <td>{p.available}</td>
                      <td>{p.outgoing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SignatureLine name={user?.name} />
            </div>
          )}
        </div>
      )}

      {tab === "sales" && (
        <div className="card no-print-margin">
          <div className="report-toolbar">
            <button className="btn btn-secondary" onClick={() => generatePeriodReport("daily")}>
              Generate Daily Report
            </button>
            <button className="btn btn-secondary" onClick={() => generatePeriodReport("weekly")}>
              Generate Weekly Report
            </button>
            <button className="btn btn-secondary" onClick={() => generatePeriodReport("monthly")}>
              Generate Monthly Report
            </button>
            <button className="btn btn-secondary" onClick={() => generatePeriodReport("yearly")}>
              Generate Yearly Report
            </button>
          </div>
          <div className="report-toolbar">
            <label className="inline-label">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="inline-label">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button className="btn btn-secondary" onClick={() => loadSalesReport()}>
              Generate custom range
            </button>
            {salesReport && (
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
            )}
          </div>

          {salesReport && (
            <div className="printable-report">
              <DocHeader
                title="Sales Report"
                subtitle={`Generated ${new Date(salesReport.generatedAt).toLocaleString()}`}
              />
              <p>
                {salesReport.totalUnits} units sold · Total revenue ₱
                {salesReport.totalRevenue.toLocaleString()}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReport.sales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.product_name} ({s.product_code})</td>
                      <td>{s.quantity}</td>
                      <td>₱{s.unit_price.toFixed(2)}</td>
                      <td>₱{s.total.toFixed(2)}</td>
                      <td className="muted">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SignatureLine name={user?.name} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}