import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

function formatLabel(day, period) {
  const date = new Date(day);
  if (period === "yearly") return String(date.getFullYear());
  if (period === "monthly") return date.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
  if (period === "weekly") return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return day.slice(5);
}

function activityBadgeClass(action) {
  const a = String(action).toLowerCase();
  if (a.includes("successful") || a.includes("sale")) return "badge-green";
  if (a.includes("return") || a.includes("cancel")) return "badge-amber";
  if (a.includes("report") || a.includes("inventory")) return "badge-blue";
  return "badge-blue";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("daily");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboard({ period }).then(setData).catch((e) => setError(e.message));
  }, [period]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page">Loading…</div>;

  const chartData = data.salesByDay.map((d) => ({ day: formatLabel(d.day, period), total: d.total }));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="page-subtitle">Here's what's happening in the store today.</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Products tracked" value={data.totalProducts} accent="blue" />
        <StatCard label="Low stock items" value={data.lowStockCount} accent="red" />
        <StatCard
          label="Inventory value"
          value={`₱${data.inventoryValue.toLocaleString()}`}
          accent="purple"
        />
        <StatCard
          label="Sales today"
          value={`₱${data.todaySalesTotal.toLocaleString()}`}
          sub={`${data.todaySalesUnits} units`}
          accent="green"
        />
      </div>

      <div className="panel-grid">
        <div className="card">
          <div className="chart-toolbar">
            <h2 className="card-title">Sales overview</h2>
            <div className="tabs">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  className={period === p.key ? "tab active" : "tab"}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#8A94A6" }} />
                <YAxis tick={{ fontSize: 12, fill: "#8A94A6" }} width={50} />
                <Tooltip formatter={(v) => `₱${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="total" stroke="#2F6FED" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Low stock alerts</h2>
          {data.lowStockItems.length === 0 ? (
            <p className="muted">Everything is well stocked.</p>
          ) : (
            <ul className="simple-list">
              {data.lowStockItems.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <span className="badge badge-red">{item.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Recent activity</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Total</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.recentTransactions.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className={`badge ${activityBadgeClass(t.type)}`}>
                    {t.type}
                  </span>
                </td>
                <td>{t.product_name}</td>
                <td>{t.quantity}</td>
                <td>{t.total ? `₱${Number(t.total).toLocaleString()}` : "—"}</td>
                <td className="muted">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {data.recentTransactions.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
